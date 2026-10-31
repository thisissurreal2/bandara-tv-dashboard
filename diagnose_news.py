#!/usr/bin/env python3
"""Read-only diagnostic: shows how many stories each national feed returns and
how many pass the keyword filter. Does NOT write news.json."""
import update_news as un

for source, url in un.FEEDS["national"]:
    print("=" * 70)
    print(url)
    try:
        items = un.fetch_feed(source, url)
    except Exception as exc:
        print("  FAILED:", type(exc).__name__, exc)
        continue
    matched = [i for i in items if un.relevant(i)]
    print(f"  items returned: {len(items)} | passed keyword filter: {len(matched)}")
    for i in items[:3]:
        print("  sample title:", i["title"][:90])
    for i in matched:
        blob = (i["title"] + " " + i["summary"]).lower()
        hits = [k for k in un.KEYWORDS if k in blob]
        print("  MATCH:", i["title"][:80], "| keywords:", hits)
