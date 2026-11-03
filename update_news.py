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

# Top outlets per section. The dashboard shows ONE top story from each outlet,
# so the three cards come from three different outlets.
#
SECTIONS = {
    "national": [
        ("ANTARA", ["https://www.antaranews.com/rss/top-news.xml"]),
        ("Detik", ["https://news.detik.com/rss"]),
        ("CNN Indonesia", ["https://www.cnnindonesia.com/nasional/rss"]),
    ],
    "international": [
        ("BBC", ["https://feeds.bbci.co.uk/news/world/rss.xml"]),
        ("Al Jazeera", ["https://www.aljazeera.com/xml/rss/all.xml"]),
        ("The Guardian", ["https://www.theguardian.com/world/rss"]),
    ],
}

# Stories older than this are not shown as "hot news".
MAX_AGE_HOURS = 48
CARDS_PER_SECTION = 3

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

def age_hours(item):
    ts = timestamp(item)
    if not ts:
        return None
    return (datetime.now(timezone.utc).timestamp() - ts) / 3600

def tidy(item, source):
    """Clean up quirks of individual outlets."""
    url = item.get("url", "")
    if "news.google.com" in url:
        # Google News adds " - Kompas.com" to titles, and its summary only repeats the title.
        item["title"] = re.sub(r"\s+-\s+[^-]{1,40}$", "", item.get("title", "")).strip()
        item["summary"] = f"Berita utama dari {source}."
        item["image"] = ""
    item["source"] = source
    return item

def fresh_sorted(items):
    """Newest first; drop stories that are too old. Stories with no date go last."""
    kept = []
    for item in items:
        age = age_hours(item)
        if age is not None and age > MAX_AGE_HOURS:
            continue
        kept.append(item)
    return sorted(kept, key=timestamp, reverse=True)

def pick_stories(outlets, previous_items, warnings):
    """One top story per outlet; fill any gaps with each outlet's next-best story."""
    per_outlet = {}
    for source, urls in outlets:
        found = []
        for url in urls:
            try:
                found.extend(fetch_feed(source, url))
            except (HTTPError, URLError, TimeoutError, ET.ParseError, OSError) as exc:
                warnings.append(f"{source}: {type(exc).__name__}")
        stories = [tidy(item, source) for item in fresh_sorted(found)]
        seen, unique = set(), []
        for story in stories:
            key = re.sub(r"[^a-z0-9]", "", story.get("title", "").lower())
            if key and key not in seen:
                seen.add(key)
                unique.append(story)
        per_outlet[source] = unique
        if not unique:
            warnings.append(f"{source}: no fresh stories")

    chosen = []
    for source, _ in outlets:
        if per_outlet[source]:
            chosen.append(per_outlet[source].pop(0))
        else:
            # Outlet failed: keep its previous story, if we have one.
            old = [i for i in previous_items if i.get("source") == source]
            if old:
                chosen.append(old[0])
                warnings.append(f"{source}: keeping previous story")

    # Not enough cards? Take second-best stories from outlets that have them.
    while len(chosen) < CARDS_PER_SECTION:
        spare = [s for s in per_outlet.values() if s]
        if not spare:
            break
        best = max(spare, key=lambda s: timestamp(s[0]))
        chosen.append(best.pop(0))

    chosen = sorted(chosen, key=timestamp, reverse=True)[:CARDS_PER_SECTION]
    for item in chosen:
        # Google News links are redirects, so there is no article page to read an image from.
        if not item.get("image") and "news.google.com" not in item.get("url", ""):
            item["image"] = article_image(item.get("url", ""))
    return chosen

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
    for section, outlets in SECTIONS.items():
        selected = pick_stories(outlets, previous.get(section, []), result["feed_warnings"])
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
    for section in ("national", "international"):
        for item in result[section]:
            print(f"  [{section}] {item['source']}: {item['title'][:80]}")
    if result["feed_warnings"]:
        print("Feed warnings:", "; ".join(result["feed_warnings"]))

if __name__ == "__main__":
    main()
