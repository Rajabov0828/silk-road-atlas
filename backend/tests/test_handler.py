import json
from typing import Any

import pytest
from botocore.exceptions import ClientError

from app.handler import handler
from app.location import LocationService

SAMARKAND = [66.9757, 39.6548]
BUKHARA = [64.4286, 39.7747]
KHIVA = [60.3639, 41.3783]
SHAHRISABZ = [66.8342, 39.0578]


class FakeRoutes:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def calculate_routes(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(("calculate_routes", kwargs))
        n_legs = len(kwargs["Waypoints"]) + 1
        leg = {
            "Geometry": {"LineString": [[1.0, 2.0], [3.0, 4.0]]},
            "VehicleLegDetails": {"Summary": {"Overview": {"Distance": 1000, "Duration": 60}}},
        }
        return {"Routes": [{"Legs": [leg] * n_legs, "Summary": {"Distance": 1000 * n_legs, "Duration": 60 * n_legs}}]}

    def optimize_waypoints(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(("optimize_waypoints", kwargs))
        ids = [w["Id"] for w in kwargs["Waypoints"]]
        return {"OptimizedWaypoints": [{"Id": "Origin"}, *[{"Id": i} for i in reversed(ids)], {"Id": "Destination"}]}

    def calculate_isolines(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(("calculate_isolines", kwargs))
        return {
            "Isolines": [
                {"TimeThreshold": t, "Geometries": [{"Polygon": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}]}
                for t in kwargs["Thresholds"]["Time"]
            ]
        }


class FakePlaces:
    def search_text(self, **kwargs: Any) -> dict[str, Any]:
        assert kwargs["Filter"]["IncludeCountries"] == ["UZB"]
        return {
            "ResultItems": [
                {"Title": "Registan", "Position": SAMARKAND, "Address": {"Label": "Samarkand, UZB"}, "PlaceType": "PointOfInterest"},
                {"Title": "No position"},
            ]
        }

    def reverse_geocode(self, **kwargs: Any) -> dict[str, Any]:
        return {"ResultItems": [{"Title": "Somewhere", "Position": kwargs["QueryPosition"]}]}


class FailingRoutes(FakeRoutes):
    def calculate_routes(self, **kwargs: Any) -> dict[str, Any]:
        raise ClientError({"Error": {"Code": "ThrottlingException", "Message": "slow down"}}, "CalculateRoutes")


def event(method: str, path: str, body: Any = None, query: dict[str, str] | None = None) -> dict[str, Any]:
    return {
        "rawPath": path,
        "requestContext": {"http": {"method": method}},
        "body": json.dumps(body) if body is not None else None,
        "queryStringParameters": query,
    }


@pytest.fixture
def routes() -> FakeRoutes:
    return FakeRoutes()


@pytest.fixture
def svc(routes: FakeRoutes) -> LocationService:
    return LocationService(routes=routes, places=FakePlaces())


def test_route_without_optimization(svc: LocationService, routes: FakeRoutes) -> None:
    res = handler(event("POST", "/api/route", {"waypoints": [SAMARKAND, BUKHARA, KHIVA]}), service=svc)
    assert res["statusCode"] == 200
    body = json.loads(res["body"])
    assert body["order"] == [0, 1, 2]
    assert body["distance_m"] == 2000
    assert len(body["legs"]) == 2
    assert routes.calls[0][1]["LegGeometryFormat"] == "Simple"


def test_route_with_optimization_keeps_endpoints(svc: LocationService, routes: FakeRoutes) -> None:
    waypoints = [SAMARKAND, BUKHARA, SHAHRISABZ, KHIVA]
    res = handler(event("POST", "/api/route", {"waypoints": waypoints, "optimize": True}), service=svc)
    body = json.loads(res["body"])
    assert body["order"] == [0, 2, 1, 3]
    assert [c[0] for c in routes.calls] == ["optimize_waypoints", "calculate_routes"]


@pytest.mark.parametrize(
    "payload",
    [
        {"waypoints": [SAMARKAND]},  # too few
        {"waypoints": [SAMARKAND, [2.35, 48.85]]},  # Paris is not in Uzbekistan
        {"waypoints": [SAMARKAND, BUKHARA], "extra": 1},  # unknown field
        {"waypoints": [SAMARKAND] * 21},  # too many
    ],
)
def test_route_validation_errors(svc: LocationService, payload: dict[str, Any]) -> None:
    res = handler(event("POST", "/api/route", payload), service=svc)
    assert res["statusCode"] == 400


def test_malformed_json_is_400(svc: LocationService) -> None:
    ev = event("POST", "/api/route")
    ev["body"] = "{not json"
    assert handler(ev, service=svc)["statusCode"] == 400


def test_body_size_limit(svc: LocationService) -> None:
    ev = event("POST", "/api/route")
    ev["body"] = json.dumps({"waypoints": [SAMARKAND, BUKHARA], "pad": "x" * 20_000})
    assert handler(ev, service=svc)["statusCode"] == 400


def test_isoline(svc: LocationService) -> None:
    res = handler(event("POST", "/api/isoline", {"origin": SAMARKAND, "minutes": [60, 15]}), service=svc)
    body = json.loads(res["body"])
    assert [i["minutes"] for i in body["isolines"]] == [60, 15]


def test_isoline_rejects_bad_minutes(svc: LocationService) -> None:
    res = handler(event("POST", "/api/isoline", {"origin": SAMARKAND, "minutes": [500]}), service=svc)
    assert res["statusCode"] == 400


def test_search_filters_items_without_position(svc: LocationService) -> None:
    res = handler(event("GET", "/api/search", query={"q": "Registan"}), service=svc)
    body = json.loads(res["body"])
    assert [r["title"] for r in body["results"]] == ["Registan"]


def test_search_requires_query(svc: LocationService) -> None:
    assert handler(event("GET", "/api/search", query={"q": "a"}), service=svc)["statusCode"] == 400
    assert handler(event("GET", "/api/search"), service=svc)["statusCode"] == 400


def test_reverse(svc: LocationService) -> None:
    res = handler(event("GET", "/api/reverse", query={"lon": "66.97", "lat": "39.65"}), service=svc)
    assert res["statusCode"] == 200
    assert handler(event("GET", "/api/reverse", query={"lon": "0", "lat": "0"}), service=svc)["statusCode"] == 400


def test_unknown_route_is_404(svc: LocationService) -> None:
    assert handler(event("GET", "/api/nope"), service=svc)["statusCode"] == 404


def test_throttling_maps_to_429() -> None:
    svc = LocationService(routes=FailingRoutes(), places=FakePlaces())
    res = handler(event("POST", "/api/route", {"waypoints": [SAMARKAND, BUKHARA]}), service=svc)
    assert res["statusCode"] == 429


def test_origin_secret_enforced(svc: LocationService, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ORIGIN_VERIFY_SECRET", "s" * 40)
    ev = event("GET", "/api/search", query={"q": "Registan"})
    assert handler(ev, service=svc)["statusCode"] == 403
    ev["headers"] = {"X-Origin-Verify": "wrong"}
    assert handler(ev, service=svc)["statusCode"] == 403
    ev["headers"] = {"x-origin-verify": "s" * 40}
    assert handler(ev, service=svc)["statusCode"] == 200
