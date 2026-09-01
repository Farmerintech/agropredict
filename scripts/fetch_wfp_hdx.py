#!/usr/bin/env python3
"""Fetch and normalize the HDX WFP Nigeria food-prices dataset.

The output is deliberately CSV so the pipeline can be inspected before a
database is selected. No values are interpolated or silently filled.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen

API_URL = "https://data.humdata.org/api/3/action/package_show?id=wfp-food-prices-for-nigeria"
FALLBACK_CSV_URL = (
    "https://data.humdata.org/dataset/42db041f-7aaf-4ab4-961f-2a12096861e7/"
    "resource/12b51155-0cd3-4806-9924-61ede4077591/download/wfp_food_prices_nga.csv"
)

OUTPUT_FIELDS = [
    "commodity", "state", "market", "price_naira", "unit",
    "observation_date", "source",
]


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "agroprice-dashboard/0.1"})
    with urlopen(request, timeout=60) as response:
        return response.read()


def resource_url() -> str:
    try:
        payload = json.loads(fetch(API_URL))
        resources = payload["result"]["resources"]
        csv_resources = [r for r in resources if str(r.get("format", "")).upper() == "CSV"]
        if csv_resources:
            return csv_resources[0].get("download_url") or csv_resources[0]["url"]
    except Exception as exc:  # fallback keeps the known public resource usable
        print(f"Warning: HDX metadata lookup failed: {exc}", file=sys.stderr)
    return FALLBACK_CSV_URL


def parse_date(value: str) -> str:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m", "%Y/%m"):
        try:
            parsed = datetime.strptime(value[:10] if fmt.endswith("%d") else value[:7], fmt)
            return parsed.strftime("%Y-%m-01")
        except ValueError:
            continue
    raise ValueError(f"Unsupported date: {value!r}")


def normalize(raw: bytes) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    rows = []
    for row in reader:
        if row.get("countryiso3", "NGA").upper() not in ("NGA", ""):
            continue
        price = (row.get("price") or "").strip()
        if not price:
            continue
        rows.append({
            "commodity": (row.get("commodity") or "").strip(),
            "state": (row.get("admin1") or "").strip() or "",
            "market": (row.get("market") or "").strip() or "",
            "price_naira": price,
            "unit": (row.get("unit") or "").strip(),
            "observation_date": parse_date(row.get("date", "")),
            "source": "wfp_hdx",
        })
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data/wfp_nigeria_normalized.csv"))
    parser.add_argument("--limit", type=int, help="Write only the first N rows for a smoke test")
    args = parser.parse_args()
    url = resource_url()
    print(f"Fetching {url}", file=sys.stderr)
    rows = normalize(fetch(url))
    if args.limit:
        rows = rows[: args.limit]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} normalized observations to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
