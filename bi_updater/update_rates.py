import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = BASE_DIR / "latest_rates.json"

BI_URL = (
    "https://www.bi.go.id/biwebservice/"
    "wskursbi.asmx/getSubKursLokal2"
)

# BI publishes by Jakarta date (UTC+7). GitHub's servers run on UTC,
# so we calculate the date ourselves instead of using the server clock.
JAKARTA = timezone(timedelta(hours=7))

# BI publishes no rates on weekends/holidays, so we look back this many days.
MAX_DAYS_BACK = 7


def fetch_rows_for(date_text):
    params = urlencode({"tgl": date_text})

    request = urllib.request.Request(
        f"{BI_URL}?{params}",
        headers={"User-Agent": "PT-Bandara-Rate-Updater/1.0"},
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        xml_data = response.read()

    root = ET.fromstring(xml_data)
    rows = []

    for element in root.iter():
        if element.tag.split("}")[-1] != "Table":
            continue

        def get_value(tag):
            for child in element:
                if child.tag.split("}")[-1] == tag:
                    return child.text
            return None

        currency = (get_value("mts_subkurslokal") or "").strip()
        if not currency:
            continue

        rows.append({
            "currency": currency,
            "nominal": get_value("nil_subkurslokal"),
            "buy": get_value("beli_subkurslokal"),
            "sell": get_value("jual_subkurslokal"),
            "date": get_value("tgl_subkurslokal"),
            "bi_id": get_value("lnk_subkurslokal"),
        })

    return rows


def find_latest_rows(start_day):
    """Walk back from start_day until BI has published rates."""
    for days_back in range(MAX_DAYS_BACK + 1):
        day = start_day - timedelta(days=days_back)
        date_text = day.strftime("%Y-%m-%d")
        rows = fetch_rows_for(date_text)

        if rows:
            return day, rows

        print(f"No rates published for {date_text}, trying the day before...")

    return None, []


def fetch_sample():
    today = datetime.now(JAKARTA).date()

    used_day, rows = find_latest_rows(today)

    if not rows:
        raise ValueError(
            f"No currency rows found for the last {MAX_DAYS_BACK + 1} days. "
            "Check the BI service response."
        )

    if used_day != today:
        print(
            f"No rates for {today}; "
            f"using the latest published rates from {used_day}."
        )

    # Also grab the previous published day, so the dashboard can show the
    # change versus the day before. If this fails, the main rates still save.
    previous = None
    try:
        previous_day, previous_rows = find_latest_rows(
            used_day - timedelta(days=1)
        )
        if previous_rows:
            previous = {
                "date": previous_day.strftime("%Y-%m-%d"),
                "rows": previous_rows,
            }
            print(f"Previous published day: {previous_day}")
    except Exception as error:
        print(f"Could not load the previous day ({error}); continuing.")

    result = {
        "source": "Bank Indonesia",
        "retrieved_at": datetime.now().astimezone().isoformat(),
        "rates_date": used_day.strftime("%Y-%m-%d"),
        "rows": rows,
        "previous": previous,
    }

    OUTPUT_FILE.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Saved {len(rows)} row(s) for {used_day} to: {OUTPUT_FILE}")

    for row in rows:
        print(
            f"{row['currency']}: "
            f"buy={row['buy']}, sell={row['sell']}, "
            f"date={row['date']}"
        )


if __name__ == "__main__":
    fetch_sample()