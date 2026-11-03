import re
import ssl
import certifi
import xml.etree.ElementTree as ET
from urllib.request import Request, urlopen

CTX = ssl.create_default_context(cafile=certifi.where())

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; PTBandaraDashboard/1.0)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

CANDIDATES = [
    ("CNN Indonesia nasional", "https://www.cnnindonesia.com/nasional/rss"),
    ("CNN Indonesia utama", "https://www.cnnindonesia.com/rss"),
    ("Tempo nasional", "https://rss.tempo.co/nasional"),
    ("Tempo terbaru", "https://rss.tempo.co/"),
    ("Liputan6 news", "https://feed.liputan6.com/rss/news"),
    ("Liputan6 terkini", "https://feed.liputan6.com/rss"),
    ("Tribunnews", "https://www.tribunnews.com/rss"),
    ("CNBC Indonesia", "https://www.cnbcindonesia.com/news/rss"),
    ("Okezone", "https://sindikasi.okezone.com/index.php/rss/0/RSS2.0"),
    ("Sindonews", "https://www.sindonews.com/feed"),
    ("Suara", "https://www.suara.com/rss"),
    ("Merdeka", "https://www.merdeka.com/feed/"),
]

MEDIA = "{http://search.yahoo.com/mrss/}"


def has_image(item):
    for tag in (MEDIA + "thumbnail", MEDIA + "content"):
        node = item.find(tag)
        if node is not None and node.attrib.get("url", "").startswith("http"):
            return True
    enclosure = item.find("enclosure")
    if enclosure is not None and enclosure.attrib.get("url", "").startswith("http"):
        return True
    desc = item.findtext("description", default="") or ""
    return bool(re.search(r"<img[^>]+src=", desc, re.I))


for name, url in CANDIDATES:
    try:
        with urlopen(Request(url, headers=HEADERS), timeout=15, context=CTX) as response:
            status = response.status
            body = response.read(2_500_000)
        root = ET.fromstring(body)
        items = root.findall(".//item")
        if not items:
            print(f"EMPTY   {name}: HTTP {status}, no stories")
            continue
        first = items[0]
        title = (first.findtext("title") or "").strip()[:60]
        date = (first.findtext("pubDate") or "").strip()
        with_img = sum(1 for i in items if has_image(i))
        print(f"OK      {name}: {len(items)} stories, {with_img} with photos | {date} | {title}")
    except Exception as error:
        print(f"FAILED  {name}: {type(error).__name__} {str(error)[:80]}")