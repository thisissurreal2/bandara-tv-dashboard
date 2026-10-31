
import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = BASE_DIR / "latest_rates.json"

BI_URL = (
    "https://www.bi.go.id/biwebservice/"
    "wskursbi.asmx/getSubKursLokal2"
)


def fetch_sample():
    from datetime import datetime

    params = urlencode({"tgl": datetime.now().strftime("%Y-%m-%d")})

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

    if not rows:
        raise ValueError(
            "No currency rows found. Check the BI service response."
        )

    result = {
        "source": "Bank Indonesia",
        "retrieved_at": datetime.now().astimezone().isoformat(),
        "rows": rows,
    }

    OUTPUT_FILE.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Saved {len(rows)} row(s) to: {OUTPUT_FILE}")

    for row in rows:
        print(
            f"{row['currency']}: "
            f"buy={row['buy']}, sell={row['sell']}, "
            f"date={row['date']}"
        )


if __name__ == "__main__":
    fetch_sample()
