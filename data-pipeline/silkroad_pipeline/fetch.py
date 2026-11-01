"""CLI: download heritage sites in Uzbekistan from Overpass and write a GeoJSON file.

Usage:
    python -m silkroad_pipeline.fetch --out ../web/public/data/heritage.geojson
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from .transform import to_geojson, transform

logger = logging.getLogger("silkroad_pipeline")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "SilkRoadAtlas/1.0 (open-source hackathon project)"
QUERY = """
[out:json][timeout:180];
area["ISO3166-1"="UZ"][admin_level=2]->.uz;
(
  nwr["historic"](area.uz);
  nwr["tourism"~"^(museum|attraction|viewpoint)$"](area.uz);
  nwr["building"="mosque"]["name"](area.uz);
);
out center tags;
"""
WHC_LIST_QUERY = """
[out:json][timeout:120];
area["ISO3166-1"="UZ"][admin_level=2]->.uz;
wr["heritage:operator"="whc"](area.uz);
out tags;
"""
WHC_MEMBERS_QUERY = """
[out:json][timeout:180];
area({area_id})->.a;
(
  nwr["historic"](area.a);
  nwr["tourism"~"^(museum|attraction|viewpoint)$"](area.a);
  nwr["building"="mosque"]["name"](area.a);
);
out ids;
"""
# Overpass derives area ids from way/relation ids with these offsets.
AREA_OFFSET = {"way": 2_400_000_000, "relation": 3_600_000_000}


def build_whc_index() -> dict[str, str]:
    """Map "type/id" of every heritage element inside a UNESCO World Heritage polygon to the site name."""
    index: dict[str, str] = {}
    sites = fetch_overpass(WHC_LIST_QUERY).get("elements", [])
    for site in sites:
        tags = site.get("tags", {})
        name = tags.get("name:en") or tags.get("name") or "UNESCO World Heritage"
        offset = AREA_OFFSET.get(site.get("type", ""))
        if offset is None:
            continue
        members = fetch_overpass(WHC_MEMBERS_QUERY.format(area_id=offset + int(site["id"]))).get("elements", [])
        logger.info("UNESCO site %r contains %d heritage elements", name, len(members))
        for member in members:
            index.setdefault(f"{member['type']}/{member['id']}", name)
        index.setdefault(f"{site['type']}/{site['id']}", name)
    return index


def fetch_overpass(query: str, retries: int = 3, timeout_s: int = 200) -> dict[str, Any]:
    body = urllib.parse.urlencode({"data": query}).encode()
    request = urllib.request.Request(
        OVERPASS_URL,
        data=body,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout_s) as response:  # noqa: S310 - fixed https URL
                return json.loads(response.read())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            wait = 10 * attempt
            logger.warning("Overpass attempt %d/%d failed (%s); retrying in %ds", attempt, retries, exc, wait)
            time.sleep(wait)
    raise RuntimeError(f"Overpass request failed after {retries} attempts") from last_error


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True, help="Output GeoJSON path")
    parser.add_argument("--raw", type=Path, help="Optional path to cache/reuse the raw Overpass response")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.raw and args.raw.exists():
        logger.info("Using cached raw response %s", args.raw)
        raw = json.loads(args.raw.read_text(encoding="utf-8"))
    else:
        logger.info("Querying Overpass API...")
        raw = fetch_overpass(QUERY)
        if args.raw:
            args.raw.parent.mkdir(parents=True, exist_ok=True)
            args.raw.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")

    elements = raw.get("elements", [])

    whc_cache = args.raw.with_name("whc_index.json") if args.raw else None
    if whc_cache and whc_cache.exists():
        whc_index: dict[str, str] = json.loads(whc_cache.read_text(encoding="utf-8"))
    else:
        logger.info("Building UNESCO World Heritage index...")
        whc_index = build_whc_index()
        if whc_cache:
            whc_cache.write_text(json.dumps(whc_index, ensure_ascii=False), encoding="utf-8")

    sites = transform(elements, whc_index)
    geojson = to_geojson(sites, raw.get("osm3s", {}).get("timestamp_osm_base", "unknown"))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(geojson, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    logger.info("Wrote %d sites (from %d raw elements) to %s", len(sites), len(elements), args.out)
    logger.info("By category: %s", geojson["metadata"]["by_category"])
    logger.info("By UNESCO site: %s", geojson["metadata"]["by_unesco_site"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
