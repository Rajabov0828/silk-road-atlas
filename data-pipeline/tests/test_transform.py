from silkroad_pipeline.models import Category, LatLon
from silkroad_pipeline.transform import (
    classify,
    deduplicate,
    haversine_km,
    nearest_city,
    to_geojson,
    transform,
)


def _node(id_: int, lat: float, lon: float, **tags: str) -> dict:
    return {"type": "node", "id": id_, "lat": lat, "lon": lon, "tags": tags}


def test_haversine_samarkand_bukhara() -> None:
    dist = haversine_km((39.6542, 66.9597), (39.7747, 64.4286))
    assert 210 < dist < 225


def test_nearest_city_and_countryside() -> None:
    assert nearest_city(LatLon(lat=39.6550, lon=66.9750)) == "Samarkand"
    assert nearest_city(LatLon(lat=43.5, lon=63.0)) == "Countryside"


def test_classify_by_name_beats_generic_historic() -> None:
    assert classify({"historic": "building", "name": "Rabati Malik caravanserai"}) == Category.CARAVANSERAI
    assert classify({"historic": "yes", "name:ru": "Медресе Улугбека"}) == Category.MADRASA


def test_classify_skips_noise() -> None:
    assert classify({"historic": "memorial", "memorial": "plaque", "name": "x"}) is None
    assert classify({"amenity": "cafe", "name": "x"}) is None


def test_transform_filters_invalid_and_out_of_bounds() -> None:
    raw = [
        _node(1, 39.6548, 66.9757, historic="monument", name="Registan", wikipedia="en:Registan"),
        _node(2, 39.65, 66.97, historic="ruins"),  # no name
        _node(3, 51.5, -0.12, historic="castle", name="Not in Uzbekistan"),  # out of bbox
        {"type": "way", "id": 4, "center": {"lat": 41.378, "lon": 60.36}, "tags": {"historic": "citywalls", "name": "Itchan Kala", "heritage:operator": "whc"}},
        {"type": "bogus", "id": 5},
    ]
    sites = transform(raw)
    names = {s.name for s in sites}
    assert names == {"Registan", "Itchan Kala"}
    itchan = next(s for s in sites if s.name == "Itchan Kala")
    assert itchan.unesco and itchan.city == "Khiva" and itchan.category == Category.FORTRESS


def test_unsafe_website_is_dropped() -> None:
    sites = transform([_node(1, 39.65, 66.97, tourism="museum", name="M", website="javascript:alert(1)")])
    assert sites[0].website is None


def test_deduplicate_keeps_highest_score() -> None:
    sites = transform(
        [
            _node(1, 39.6548, 66.9757, historic="monument", name="Registan"),
            _node(2, 39.6549, 66.9758, historic="monument", name="Registan", wikipedia="en:Registan"),
        ]
    )
    assert len(deduplicate(sites)) == 1
    assert sites[0].wikipedia == "en:Registan"


def test_geojson_shape() -> None:
    sites = transform([_node(1, 39.6548, 66.9757, tourism="museum", name="Museum")])
    gj = to_geojson(sites, "2026-01-01")
    feature = gj["features"][0]
    assert feature["geometry"]["coordinates"] == [66.9757, 39.6548]
    assert feature["properties"]["category"] == "museum"
    assert gj["metadata"]["count"] == 1


def test_unesco_from_whc_index_and_bukhara_fallback() -> None:
    sites = transform(
        [
            _node(1, 39.6548, 66.9757, historic="monument", name="Registan"),
            _node(2, 39.7758, 64.4142, historic="tower", name="Kalyan Minaret"),
            _node(3, 40.10, 65.40, historic="ruins", name="Somewhere else"),
        ],
        whc_index={"node/1": "Samarkand – Crossroad of Cultures"},
    )
    by_name = {s.name: s for s in sites}
    assert by_name["Registan"].unesco_site == "Samarkand – Crossroad of Cultures"
    assert by_name["Kalyan Minaret"].unesco_site == "Historic Centre of Bukhara"
    assert not by_name["Somewhere else"].unesco
    assert by_name["Registan"].score > by_name["Somewhere else"].score
