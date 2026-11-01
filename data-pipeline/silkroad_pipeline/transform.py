"""Pure transformation logic: raw OSM elements -> HeritageSite -> GeoJSON."""

from __future__ import annotations

import logging
import math
import re
from collections import Counter
from collections.abc import Iterable
from typing import Any

from pydantic import ValidationError

from .models import Category, HeritageSite, LatLon, OsmElement

logger = logging.getLogger(__name__)

# Historic Silk Road cities and regional centres of Uzbekistan (lat, lon).
CITIES: dict[str, tuple[float, float]] = {
    "Tashkent": (41.3111, 69.2797),
    "Samarkand": (39.6542, 66.9597),
    "Bukhara": (39.7747, 64.4286),
    "Khiva": (41.3783, 60.3639),
    "Urgench": (41.5500, 60.6333),
    "Nukus": (42.4600, 59.6000),
    "Termez": (37.2242, 67.2783),
    "Shahrisabz": (39.0578, 66.8342),
    "Karshi": (38.8606, 65.7891),
    "Navoi": (40.0844, 65.3792),
    "Jizzakh": (40.1158, 67.8422),
    "Gulistan": (40.4897, 68.7842),
    "Kokand": (40.5286, 70.9425),
    "Fergana": (40.3842, 71.7843),
    "Margilan": (40.4711, 71.7247),
    "Andijan": (40.7821, 72.3442),
    "Namangan": (40.9983, 71.6726),
}
CITY_RADIUS_KM = 35.0
COUNTRYSIDE = "Countryside"

_NAME_PATTERNS: list[tuple[re.Pattern[str], Category]] = [
    (re.compile(r"caravan|karvon|караван|rabat|рабат", re.I), Category.CARAVANSERAI),
    (re.compile(r"madras|madrasa|медресе|madrasah", re.I), Category.MADRASA),
    (re.compile(r"mausoleum|maqbara|мавзолей|mazar|мазар", re.I), Category.MAUSOLEUM),
    (re.compile(r"mosque|masjid|мечеть|machit", re.I), Category.MOSQUE),
]

_HISTORIC_MAP: dict[str, Category] = {
    "caravanserai": Category.CARAVANSERAI,
    "tomb": Category.MAUSOLEUM,
    "mausoleum": Category.MAUSOLEUM,
    "archaeological_site": Category.ARCHAEOLOGY,
    "castle": Category.FORTRESS,
    "fort": Category.FORTRESS,
    "city_gate": Category.FORTRESS,
    "citywalls": Category.FORTRESS,
    "ruins": Category.FORTRESS,
    "tower": Category.FORTRESS,
    "monument": Category.MONUMENT,
    "memorial": Category.MONUMENT,
    "building": Category.ATTRACTION,
    "religious": Category.MOSQUE,
}

# Low-value memorial subtypes that would add noise to the map.
_SKIPPED_MEMORIALS = {"plaque", "stolperstein", "bench", "blue_plaque", "grave"}


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lon) points in kilometres."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def nearest_city(pos: LatLon) -> str:
    best_name, best_dist = COUNTRYSIDE, math.inf
    for name, coords in CITIES.items():
        dist = haversine_km((pos.lat, pos.lon), coords)
        if dist < best_dist:
            best_name, best_dist = name, dist
    return best_name if best_dist <= CITY_RADIUS_KM else COUNTRYSIDE


def classify(tags: dict[str, str]) -> Category | None:
    """Map OSM tags to a heritage category; returns None for noise."""
    if tags.get("memorial") in _SKIPPED_MEMORIALS:
        return None

    names = " ".join(v for k, v in tags.items() if k.startswith("name"))
    for pattern, category in _NAME_PATTERNS:
        if pattern.search(names):
            return category

    building = tags.get("building", "")
    if building in {"mosque"} or (tags.get("amenity") == "place_of_worship" and tags.get("religion") == "muslim"):
        return Category.MOSQUE

    historic = tags.get("historic")
    if historic in _HISTORIC_MAP:
        return _HISTORIC_MAP[historic]

    tourism = tags.get("tourism")
    if tourism == "museum":
        return Category.MUSEUM
    if tourism in {"attraction", "viewpoint"} or historic:
        return Category.ATTRACTION
    return None


def pick_name(tags: dict[str, str]) -> str | None:
    for key in ("name:en", "name:uz", "name", "name:ru"):
        value = tags.get(key, "").strip()
        if value:
            return value
    return None


def is_unesco(tags: dict[str, str]) -> bool:
    operator = tags.get("heritage:operator", "").lower()
    return operator == "whc" or tags.get("heritage") == "1" or "unesco" in tags.get("heritage:operator", "").lower()


def score(tags: dict[str, str], unesco: bool) -> int:
    """Simple significance score used for ranking and label priority."""
    points = 0
    points += 5 if unesco else 0
    points += 3 if tags.get("wikipedia") else 0
    points += 2 if tags.get("wikidata") else 0
    points += 1 if tags.get("name:en") else 0
    points += 1 if tags.get("start_date") else 0
    return points


# Major UNESCO World Heritage cultural zones in Uzbekistan.
# Since OSM relations for heritage boundaries can be incomplete, we define canonical centres & radii.
UNESCO_ZONES: list[tuple[str, tuple[float, float], float]] = [
    ("Historic Centre of Bukhara", (39.7760, 64.4110), 1.3),
    ("Itchan Kala", (41.3780, 60.3600), 0.85),
    ("Samarkand – Crossroad of Cultures", (39.6545, 66.9760), 3.5),
    ("Historic Centre of Shakhrisyabz", (39.0550, 66.8300), 1.5),
]


def unesco_site_for(element_key: str, pos: LatLon, tags: dict[str, str], whc_index: dict[str, str]) -> str | None:
    if element_key in whc_index:
        return whc_index[element_key]
    for name, center, radius in UNESCO_ZONES:
        if haversine_km((pos.lat, pos.lon), center) <= radius:
            return name
    if is_unesco(tags):
        return tags.get("heritage:name") or "UNESCO World Heritage"
    return None


def to_site(element: OsmElement, whc_index: dict[str, str] | None = None) -> HeritageSite | None:
    pos = element.position()
    name = pick_name(element.tags)
    if pos is None or name is None:
        return None
    category = classify(element.tags)
    if category is None:
        return None

    tags = element.tags
    key = f"{element.type}/{element.id}"
    unesco_site = unesco_site_for(key, pos, tags, whc_index or {})
    unesco = unesco_site is not None
    wikidata = tags.get("wikidata") or None
    try:
        return HeritageSite(
            id=key,
            name=name,
            name_en=tags.get("name:en") or None,
            category=category,
            city=nearest_city(pos),
            lat=round(pos.lat, 6),
            lon=round(pos.lon, 6),
            unesco=unesco,
            unesco_site=unesco_site,
            wikipedia=tags.get("wikipedia") or None,
            wikidata=wikidata if wikidata and re.fullmatch(r"Q\d+", wikidata) else None,
            website=tags.get("website") or tags.get("contact:website"),
            start_date=tags.get("start_date") or None,
            score=score(tags, unesco),
        )
    except ValidationError as exc:
        logger.warning("Skipping %s/%s: %s", element.type, element.id, exc.errors()[0]["msg"])
        return None


def deduplicate(sites: Iterable[HeritageSite]) -> list[HeritageSite]:
    """Remove duplicates that share a name and lie within 150 m (node + way of same site)."""
    kept: list[HeritageSite] = []
    for site in sorted(sites, key=lambda s: -s.score):
        duplicate = any(
            k.name.lower() == site.name.lower() and haversine_km((k.lat, k.lon), (site.lat, site.lon)) < 0.15
            for k in kept
        )
        if not duplicate:
            kept.append(site)
    return kept


def transform(raw_elements: Iterable[dict[str, Any]], whc_index: dict[str, str] | None = None) -> list[HeritageSite]:
    """Clean raw OSM elements. `whc_index` maps "type/id" -> UNESCO World Heritage site name."""
    sites: list[HeritageSite] = []
    for raw in raw_elements:
        try:
            element = OsmElement.model_validate(raw)
        except ValidationError as exc:
            logger.warning("Invalid OSM element %s: %s", raw.get("id"), exc.errors()[0]["msg"])
            continue
        site = to_site(element, whc_index)
        if site is not None:
            sites.append(site)
    return deduplicate(sites)


def to_geojson(sites: list[HeritageSite], osm_timestamp: str) -> dict[str, Any]:
    features = [
        {
            "type": "Feature",
            "id": index,
            "geometry": {"type": "Point", "coordinates": [s.lon, s.lat]},
            "properties": s.model_dump(mode="json", exclude={"lat", "lon"}, exclude_none=True),
        }
        for index, s in enumerate(sites)
    ]
    return {
        "type": "FeatureCollection",
        "metadata": {
            "source": "OpenStreetMap contributors via Overpass API",
            "license": "ODbL 1.0 — https://www.openstreetmap.org/copyright",
            "osm_timestamp": osm_timestamp,
            "count": len(features),
            "by_category": dict(Counter(s.category.value for s in sites)),
            "by_city": dict(Counter(s.city for s in sites)),
            "by_unesco_site": dict(Counter(s.unesco_site for s in sites if s.unesco_site)),
        },
        "features": features,
    }
