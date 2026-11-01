"""Request/response models for the Silk Road Atlas API."""

from __future__ import annotations

from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

# Uzbekistan bounding box with a small margin (lon/lat, WGS84).
UZ_BBOX: tuple[float, float, float, float] = (55.5, 36.8, 73.5, 46.0)


def _inside_uzbekistan(value: tuple[float, float]) -> tuple[float, float]:
    lon, lat = value
    min_lon, min_lat, max_lon, max_lat = UZ_BBOX
    if not (min_lon <= lon <= max_lon and min_lat <= lat <= max_lat):
        raise ValueError("coordinate must be inside Uzbekistan")
    return (round(lon, 6), round(lat, 6))


Position = Annotated[tuple[float, float], AfterValidator(_inside_uzbekistan)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RouteRequest(StrictModel):
    waypoints: list[Position] = Field(min_length=2, max_length=20)
    optimize: bool = False


class IsolineRequest(StrictModel):
    origin: Position
    minutes: list[int] = Field(default=[15, 30, 60], min_length=1, max_length=3)

    @field_validator("minutes")
    @classmethod
    def valid_minutes(cls, value: list[int]) -> list[int]:
        if any(m < 5 or m > 120 for m in value):
            raise ValueError("minutes must be between 5 and 120")
        return sorted(set(value))


class SearchRequest(StrictModel):
    q: str = Field(min_length=2, max_length=120)


class ReverseRequest(StrictModel):
    lon: float
    lat: float

    def position(self) -> tuple[float, float]:
        return _inside_uzbekistan((self.lon, self.lat))


class RouteLeg(BaseModel):
    distance_m: int
    duration_s: int
    coordinates: list[tuple[float, float]]


class RouteResponse(BaseModel):
    order: list[int]
    distance_m: int
    duration_s: int
    legs: list[RouteLeg]


class Isoline(BaseModel):
    minutes: int
    polygons: list[list[list[tuple[float, float]]]]


class IsolineResponse(BaseModel):
    isolines: list[Isoline]


class Place(BaseModel):
    title: str
    label: str | None = None
    position: tuple[float, float]
    place_type: str | None = None


class PlacesResponse(BaseModel):
    results: list[Place]
