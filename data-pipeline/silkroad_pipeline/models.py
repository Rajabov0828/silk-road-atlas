"""Typed models for raw OpenStreetMap elements and the cleaned heritage dataset."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Category(str, Enum):
    """Heritage categories shown as filters on the map."""

    CARAVANSERAI = "caravanserai"
    MAUSOLEUM = "mausoleum"
    MOSQUE = "mosque"
    MADRASA = "madrasa"
    FORTRESS = "fortress"
    ARCHAEOLOGY = "archaeology"
    MUSEUM = "museum"
    MONUMENT = "monument"
    ATTRACTION = "attraction"


class LatLon(BaseModel):
    model_config = ConfigDict(frozen=True)

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class OsmElement(BaseModel):
    """A single element returned by the Overpass API (`out center tags`)."""

    type: Literal["node", "way", "relation"]
    id: int
    lat: float | None = None
    lon: float | None = None
    center: LatLon | None = None
    tags: dict[str, str] = Field(default_factory=dict)

    def position(self) -> LatLon | None:
        if self.lat is not None and self.lon is not None:
            return LatLon(lat=self.lat, lon=self.lon)
        return self.center


class HeritageSite(BaseModel):
    """A cleaned, map-ready heritage site."""

    id: str = Field(pattern=r"^(node|way|relation)/\d+$")
    name: str = Field(min_length=1, max_length=200)
    name_en: str | None = None
    category: Category
    city: str
    lat: float = Field(ge=37.0, le=46.0)
    lon: float = Field(ge=55.0, le=74.0)
    unesco: bool = False
    unesco_site: str | None = Field(default=None, max_length=200)
    wikipedia: str | None = None
    wikidata: str | None = Field(default=None, pattern=r"^Q\d+$")
    website: str | None = None
    start_date: str | None = None
    score: int = Field(ge=0)

    @field_validator("website")
    @classmethod
    def only_http_urls(cls, value: str | None) -> str | None:
        """Drop non-http(s) URLs so nothing like `javascript:` can reach the UI."""
        if value is None:
            return None
        value = value.strip()
        return value if value.startswith(("https://", "http://")) else None
