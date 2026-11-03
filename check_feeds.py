import ssl
import certifi
import xml.etree.ElementTree as ET
from urllib.request import Request, urlopen

CTX = ssl.create_default_context(cafile=certifi.where())

CANDIDATES = {
    "INTERNATIONAL": [
        ("BBC", "https://feeds.bbci.co.uk/news/world/rss.xml"),
        ("BBC top stories", "https://feeds.bbci.co.uk/news/rss.xml"),
        ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
        ("Guardian world", "https://www.theguardian.com/world/rss"),
        ("NPR world", "https://feeds.npr.org/1004/rss.xml"),
    ],
    "NATIONAL": [
        ("ANTARA top", "https://www.antaranews.com/rss/top-news.xml"),
        ("ANTARA terkini", "https://www.antaranews.com/rss/terkini.xml"),
        ("Detik 1", "https://rss.detik.com/index.php/detikcom"),
        ("Detik 2", "https://news.detik.com/rss"),
        ("Detik 3", "https://www.detik.com/rss"),
        ("Kompas 1", "https://www.kompas.com/getrss/nasional"),
        ("Kompas 2", "https://www.kompas.com/rss"),
        ("Kompas 3", "https://rss.kompas.com/"),
    ],
}

UA = "Mozilla/5.0 (compatible; BandaraDashboard/1.0)"


def check(name, url):
    try:
        req = Request(url, headers={"User-Agent": UA})
        with urlopen(req, timeout=15, context=CTX) as response:
            data = response.read()
        root = ET.fromstring(data)
        items = root.findall(".//item")
        if items:
            title = (items[0].findtext("title") or "").strip()
            date = (items[0].findtext("pubDate") or "").strip()
        else:
            ns = {"a": "http://www.w3.org/2005/Atom"}
            entries = root.findall(".//a:entry", ns)
            items = entries
            title = (entries[0].findtext("a:title", default="", namespaces=ns) if entries else "").strip()
            date = (entries[0].findtext("a:updated", default="", namespaces=ns) if entries else "").strip()
        if not items:
            return f"EMPTY   {name}: no stories found"
        return f"OK      {name}: {len(items)} stories | newest: {title[:70]} | {date}"
    except Exception as error:
        return f"FAILED  {name}: {type(error).__name__} {error}"


for section, feeds in CANDIDATES.items():
    print(f"\n=== {section} ===")
    for name, url in feeds:
        print(check(name, url))