"""Thin, testable wrapper around Amazon Location Service (Routes v2 + Places v2)."""

from __future__ import annotations

import logging
from typing import Any, Protocol

from .models import (
    UZ_BBOX,
    Isoline,
    IsolineResponse,
    Place,
    PlacesResponse,
    RouteLeg,
    RouteResponse,
)

logger = logging.getLogger(__name__)


class RoutesClient(Protocol):
    def calculate_routes(self, **kwargs: Any) -> dict[str, Any]: ...
    def optimize_waypoints(self, **kwargs: Any) -> dict[str, Any]: ...
    def calculate_isolines(self, **kwargs: Any) -> dict[str, Any]: ...


class PlacesClient(Protocol):
    def search_text(self, **kwargs: Any) -> dict[str, Any]: ...
    def reverse_geocode(self, **kwargs: Any) -> dict[str, Any]: ...


class LocationService:
    """Business logic on top of the geo-routes and geo-places boto3 clients."""

    def __init__(self, routes: RoutesClient, places: PlacesClient) -> None:
        self._routes = routes
        self._places = places

    # ---------- Routes ----------
    def optimize_order(self, waypoints: list[tuple[float, float]]) -> list[int]:
        """Keep first and last point fixed and reorder the stops in between."""
        if len(waypoints) <= 3:
            return list(range(len(waypoints)))
        middle = [{"Id": str(i), "Position": list(p)} for i, p in enumerate(waypoints[1:-1], start=1)]
        response = self._routes.optimize_waypoints(
            Origin=list(waypoints[0]),
            Destination=list(waypoints[-1]),
            Waypoints=middle,
            TravelMode="Car",
        )
        valid_ids = {w["Id"] for w in middle}
        ordered = [int(w["Id"]) for w in response.get("OptimizedWaypoints", []) if w.get("Id") in valid_ids]
        if sorted(ordered) != list(range(1, len(waypoints) - 1)):
            logger.warning("OptimizeWaypoints returned an incomplete order; falling back to input order")
            ordered = list(range(1, len(waypoints) - 1))
        return [0, *ordered, len(waypoints) - 1]

    def route(self, waypoints: list[tuple[float, float]], optimize: bool) -> RouteResponse:
        order = self.optimize_order(waypoints) if optimize else list(range(len(waypoints)))
        ordered = [waypoints[i] for i in order]
        response = self._routes.calculate_routes(
            Origin=list(ordered[0]),
            Destination=list(ordered[-1]),
            Waypoints=[{"Position": list(p), "PassThrough": False} for p in ordered[1:-1]],
            TravelMode="Car",
            LegGeometryFormat="Simple",
            LegAdditionalFeatures=["Summary"],
        )
        routes = response.get("Routes") or []
        if not routes:
            raise LookupError("No route found between these points")
        best = routes[0]
        legs = [self._parse_leg(leg) for leg in best.get("Legs", [])]
        summary = best.get("Summary", {})
        return RouteResponse(
            order=order,
            distance_m=int(summary.get("Distance", sum(leg.distance_m for leg in legs))),
            duration_s=int(summary.get("Duration", sum(leg.duration_s for leg in legs))),
            legs=legs,
        )

    @staticmethod
    def _parse_leg(leg: dict[str, Any]) -> RouteLeg:
        coords = [(float(c[0]), float(c[1])) for c in leg.get("Geometry", {}).get("LineString", [])]
        overview = (
            leg.get("VehicleLegDetails", {}).get("Summary", {}).get("Overview")
            or leg.get("FerryLegDetails", {}).get("Summary", {}).get("Overview")
            or {}
        )
        return RouteLeg(
            distance_m=int(overview.get("Distance", 0)),
            duration_s=int(overview.get("Duration", 0)),
            coordinates=coords,
        )

    def isolines(self, origin: tuple[float, float], minutes: list[int]) -> IsolineResponse:
        response = self._routes.calculate_isolines(
            Origin=list(origin),
            Thresholds={"Time": [m * 60 for m in minutes]},
            TravelMode="Car",
            IsolineGeometryFormat="Simple",
        )
        result: list[Isoline] = []
        for item in response.get("Isolines", []):
            polygons = [
                [[(float(c[0]), float(c[1])) for c in ring] for ring in geometry.get("Polygon", [])]
                for geometry in item.get("Geometries", [])
                if geometry.get("Polygon")
            ]
            result.append(Isoline(minutes=int(item.get("TimeThreshold", 0)) // 60, polygons=polygons))
        return IsolineResponse(isolines=sorted(result, key=lambda i: -i.minutes))

    # ---------- Places ----------
    @staticmethod
    def _parse_places(items: list[dict[str, Any]]) -> PlacesResponse:
        results = [
            Place(
                title=item.get("Title", ""),
                label=item.get("Address", {}).get("Label"),
                position=(float(item["Position"][0]), float(item["Position"][1])),
                place_type=item.get("PlaceType"),
            )
            for item in items
            if item.get("Position")
        ]
        return PlacesResponse(results=results)

    def search(self, query: str) -> PlacesResponse:
        response = self._places.search_text(
            QueryText=query,
            Filter={"BoundingBox": list(UZ_BBOX), "IncludeCountries": ["UZB"]},
            MaxResults=8,
            Language="en",
        )
        return self._parse_places(response.get("ResultItems", []))

    def reverse(self, position: tuple[float, float]) -> PlacesResponse:
        response = self._places.reverse_geocode(QueryPosition=list(position), MaxResults=1, Language="en")
        return self._parse_places(response.get("ResultItems", []))
