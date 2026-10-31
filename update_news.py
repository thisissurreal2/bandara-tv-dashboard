#!/usr/bin/env python3
"""Fetch PT Bandara news feeds and write news.json. Run from dashboard root."""
from __future__ import annotations

import ssl
import certifi
import html
import json
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "news.json"
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

# Keep the sections separate: international uses BBC World only; national uses ANTARA Indonesia/ASEAN.
FEEDS = {
    "national": [
        # Indonesian-language ANTARA feeds, listed on https://www.antaranews.com/rss/
        ("ANTARA", "https://www.antaranews.com/rss/terkini.xml"),
        ("ANTARA", "https://www.antaranews.com/rss/top-news.xml"),
        ("ANTARA", "https://www.antaranews.com/rss/ekonomi.xml"),
        ("ANTARA", "https://www.antaranews.com/rss/politik.xml"),
        ("ANTARA", "https://www.antaranews.com/rss/metro.xml"),
        # National-section wire stories republished on ANTARA's Bangka Belitung site.
        ("ANTARA", "https://babel.antaranews.com/rss/nasional.xml"),
    ],
    "international": [
        ("Simple Flying", "https://simpleflying.com/feed/"),
        ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ],
}
KEYWORDS = [
    "aviation industry", "commercial aviation", "air traffic",
    "air traffic control", "airport security", "airspace",
    "fighter jet", "fighter aircraft", "helicopter", "runway",
    "air cargo", "aviation safety", "flight operations",
    "aircraft manufacturer", "aircraft accident",
    "aircraft incident", "air transport", "airline industry", "aviation", "airline", "airport", "aircraft", "airplane", "flight",
    "aerospace", "dirgantara", "penerbangan", "bandara", "pesawat",
    "angkasa", "air force", "angkatan udara", "transportasi udara", "wilayah udara", "ruang udara", "defence", "defense", "military",
    "pertahanan", "drone", "airbus", "boeing", "lion air",
    "garuda indonesia", "tni au", "transportasi", "infrastruktur",
    "maskapai", "alutsista", "kemhan",
]

def clean(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", html.unescape(value)).strip()

def text_of(item, *names):
    for name in names:
        node = item.find(name)
        if node is not None and node.text:
            return clean(node.text)
    return ""

def normalize_date(value):
    if not value:
        return ""
    try:
        dt = parsedate_to_datetime(value)
    except Exception:
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()

def image_from_item(item):
    for tag in (
        "{http://search.yahoo.com/mrss/}thumbnail",
        "{http://search.yahoo.com/mrss/}content",
        "{http://www.w3.org/2005/Atom}thumbnail",
    ):
        node = item.find(tag)
        if node is not None:
            url = node.attrib.get("url", "")
            if url.startswith(("https://", "http://")):
                return url
    enclosure = item.find("enclosure")
    if enclosure is not None:
        url = enclosure.attrib.get("url", "")
        if url.startswith(("https://", "http://")) and enclosure.attrib.get("type", "").startswith("image/"):
            return url
    desc = item.findtext("description", default="") or ""
    match = re.search(r'<img[^>]+src=["\']([^"\']+)', desc, re.I)
    if match and match.group(1).startswith(("https://", "http://")):
        return match.group(1)
    return ""

def article_image(url):
    """Best-effort og:image lookup when the RSS item has no image."""
    if not url:
        return ""
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; PTBandaraDashboard/1.0)"})
        with urlopen(req, timeout=8, context=SSL_CONTEXT) as response:
            page = response.read(350_000).decode("utf-8", "replace")
        for pattern in (
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
            r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)',
        ):
            match = re.search(pattern, page, re.I)
            if match and match.group(1).startswith(("https://", "http://")):
                return html.unescape(match.group(1))
    except Exception:
        pass
    return ""

def fetch_feed(source, url):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; PTBandaraDashboard/1.0)"})
    with urlopen(req, timeout=15, context=SSL_CONTEXT) as response:
        raw = response.read(2_500_000)
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        print(f"\nParse error from {source} ({url}): {e}")
        print("Response preview:", repr(raw[:300]))
        raise  # main() records "<source>: ParseError" in feed_warnings
    found = []
    for item in root.findall(".//item"):
        title = text_of(item, "title")
        link = text_of(item, "link")
        summary = text_of(item, "description")
        pub = normalize_date(text_of(item, "pubDate"))
        if title and link:
            found.append({
                "title": title, "summary": summary, "url": link, "source": source,
                "published": pub, "image": image_from_item(item)
            })
    if not found:
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for item in root.findall(".//a:entry", ns):
            title = clean(item.findtext("a:title", default="", namespaces=ns))
            linknode = item.find("a:link", ns)
            link = linknode.attrib.get("href", "") if linknode is not None else ""
            summary = clean(item.findtext("a:summary", default="", namespaces=ns))
            pub = normalize_date(item.findtext("a:published", default="", namespaces=ns) or item.findtext("a:updated", default="", namespaces=ns))
            if title and link:
                found.append({"title": title, "summary": summary, "url": link, "source": source, "published": pub, "image": image_from_item(item)})
    return found

def timestamp(item):
    try:
        return datetime.fromisoformat((item.get("published") or "").replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0

def dedupe(items, limit=3):
    seen, result = set(), []
    for item in sorted(items, key=timestamp, reverse=True):
        key = re.sub(r"[^a-z0-9]", "", item.get("title", "").lower())
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(item)
        if len(result) >= limit:
            break
    return result

WHOLE_WORD_KEYWORDS = ["tni"]  # short words that would otherwise match inside e.g. "etnis"

def relevant(item):
    blob = (item.get("title", "") + " " + item.get("summary", "")).lower()
    if any(word in blob for word in KEYWORDS):
        return True
    return any(re.search(rf"\b{re.escape(w)}\b", blob) for w in WHOLE_WORD_KEYWORDS)

def main():
    previous = {}
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:
            pass
    result = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "national": [], "international": [], "feed_warnings": []
    }
    for section, feeds in FEEDS.items():
        items = []
        for source, url in feeds:
            try:
                items.extend(fetch_feed(source, url))
            except (HTTPError, URLError, TimeoutError, ET.ParseError, OSError) as exc:
                result["feed_warnings"].append(f"{source}: {type(exc).__name__}")
        # Only aviation/defence/transport-relevant stories are kept. If fewer than three
        # match, the section shows fewer than three; unrelated stories are never added.
        filtered = [item for item in items if relevant(item)]
        selected = dedupe(filtered, 3)
        # Fill missing thumbnails from each article page; keep this best-effort.
        for item in selected:
            if not item.get("image"):
                item["image"] = article_image(item.get("url", ""))
        if selected:
            result[section] = selected
        else:
            result[section] = previous.get(section, [])
            if previous.get(section):
                result["feed_warnings"].append(
                    f"{section}: no new usable stories; keeping previous headlines"
                )
    if not result["national"] and not result["international"]:
        if previous:
            previous["last_fetch_failed_at"] = result["updated_at"]
            OUT.write_text(json.dumps(previous, ensure_ascii=False, indent=2), encoding="utf-8")
            print("All feeds failed; kept previous news.json")
            return
        raise SystemExit("No feeds could be fetched and no previous news.json exists.")
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} — national: {len(result['national'])}, international: {len(result['international'])}")
    if result["feed_warnings"]:
        print("Feed warnings:", "; ".join(result["feed_warnings"]))

if __name__ == "__main__":
    main()