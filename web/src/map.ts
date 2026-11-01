import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap, StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { CATEGORY_META, UZ_BOUNDS, amazonStyleUrl, type AppConfig } from './config';
import type { Category, LngLat, RouteResult, SiteFeature } from './types';

maplibregl.setWorkerUrl(workerUrl);

export const SRC_SITES = 'sites';
export const SRC_ROUTE = 'route';
export const SRC_ISO = 'isolines';
export const SRC_STOPS = 'stops';

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-tiles-layer', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 }],
};

class ThreeDControl implements maplibregl.IControl {
  private _map?: MLMap;
  private _btn?: HTMLButtonElement;
  private _container?: HTMLDivElement;
  private _is3d = false;

  onAdd(map: MLMap): HTMLElement {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this._btn = document.createElement('button');
    this._btn.type = 'button';
    this._btn.className = 'maplibregl-ctrl-3d';
    this._btn.title = 'Toggle 3D perspective pitch';
    this._btn.innerHTML = '<span style="font-weight:800;font-size:12px;letter-spacing:-0.5px;">3D</span>';
    this._btn.onclick = () => this.toggle();
    this._container.appendChild(this._btn);

    map.on('pitch', () => {
      const active = map.getPitch() > 15;
      if (this._is3d !== active) {
        this._is3d = active;
        this.updateStyle();
      }
    });

    return this._container;
  }

  toggle(): void {
    if (!this._map) return;
    this._is3d = !this._is3d;
    this._map.easeTo({
      pitch: this._is3d ? 55 : 0,
      bearing: this._is3d ? -20 : 0,
      duration: 1000,
    });
    this.updateStyle();
  }

  private updateStyle(): void {
    if (!this._btn) return;
    this._btn.style.color = this._is3d ? '#1d4ed8' : '#334155';
    this._btn.style.backgroundColor = this._is3d ? '#eff6ff' : '#ffffff';
  }

  onRemove(): void {
    this._container?.remove();
    this._map = undefined;
  }
}

export function createMap(container: string, cfg: AppConfig): MLMap {
  const styleUrl = amazonStyleUrl(cfg, 'Standard', false);
  const map = new maplibregl.Map({
    container,
    style: styleUrl ?? FALLBACK_STYLE,
    bounds: UZ_BOUNDS,
    fitBoundsOptions: { padding: 30 },
    attributionControl: { compact: true, customAttribution: 'Heritage data © OpenStreetMap contributors (ODbL)' },
    maxBounds: [
      [48, 33],
      [80, 49],
    ],
  });
  map.addControl(new ThreeDControl(), 'top-left');
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
  map.addControl(new maplibregl.FullscreenControl(), 'top-left');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  return map;
}

function categoryColorExpression(): maplibregl.ExpressionSpecification {
  const pairs = (Object.keys(CATEGORY_META) as Category[]).flatMap((c) => [c, CATEGORY_META[c].color]);
  return ['match', ['get', 'category'], ...pairs, '#cccccc'] as unknown as maplibregl.ExpressionSpecification;
}

export function addLayers(map: MLMap): void {
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

  map.addSource(SRC_ISO, { type: 'geojson', data: empty });
  map.addLayer({
    id: 'iso-fill',
    type: 'fill',
    source: SRC_ISO,
    paint: {
      'fill-color': ['interpolate', ['linear'], ['get', 'minutes'], 15, '#0d9488', 30, '#0284c7', 60, '#2563eb', 120, '#4338ca'],
      'fill-opacity': 0.22,
    },
  });
  map.addLayer({
    id: 'iso-line',
    type: 'line',
    source: SRC_ISO,
    paint: { 'line-color': '#0284c7', 'line-width': 1.8, 'line-opacity': 0.85 },
  });

  map.addSource(SRC_ROUTE, { type: 'geojson', data: empty, lineMetrics: true });
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: SRC_ROUTE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.95 },
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: SRC_ROUTE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-width': 4.5,
      'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#06b6d4', 0.5, '#2563eb', 1, '#1e40af'],
    },
  });

  map.addSource(SRC_SITES, {
    type: 'geojson',
    data: empty,
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 12,
    clusterProperties: { unesco: ['+', ['case', ['get', 'unesco'], 1, 0]] },
  });
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: SRC_SITES,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#1d4ed8', 20, '#2563eb', 100, '#0284c7'],
      'circle-radius': ['step', ['get', 'point_count'], 16, 20, 22, 100, 30],
      'circle-stroke-width': ['case', ['>', ['get', 'unesco'], 0], 3, 2],
      'circle-stroke-color': ['case', ['>', ['get', 'unesco'], 0], '#38bdf8', '#ffffff'],
      'circle-opacity': 0.92,
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: SRC_SITES,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 13,
      'text-font': ['Amazon Ember Bold', 'Noto Sans Bold'],
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: 'site-points',
    type: 'circle',
    source: SRC_SITES,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': categoryColorExpression(),
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4.5, 14, 8.5],
      'circle-stroke-width': ['case', ['get', 'unesco'], 2.5, 1.5],
      'circle-stroke-color': ['case', ['get', 'unesco'], '#1d4ed8', '#ffffff'],
    },
  });
  map.addLayer({
    id: 'site-labels',
    type: 'symbol',
    source: SRC_SITES,
    filter: ['!', ['has', 'point_count']],
    minzoom: 12,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 12,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-font': ['Amazon Ember Regular', 'Noto Sans Regular'],
      'symbol-sort-key': ['-', 0, ['get', 'score']],
      'text-optional': true,
    },
    paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 2.0 },
  });

  map.addSource(SRC_STOPS, { type: 'geojson', data: empty });
  map.addLayer({
    id: 'stops',
    type: 'circle',
    source: SRC_STOPS,
    paint: { 'circle-radius': 11, 'circle-color': '#1d4ed8', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 },
  });
  map.addLayer({
    id: 'stops-label',
    type: 'symbol',
    source: SRC_STOPS,
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-font': ['Amazon Ember Bold', 'Noto Sans Bold'],
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  });
}

export function setSites(map: MLMap, features: SiteFeature[]): void {
  (map.getSource(SRC_SITES) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection);
}

export function setRoute(map: MLMap, legs: RouteResult['legs'] | null): void {
  const coords = legs ? legs.flatMap((l) => l.coordinates) : [];
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: coords.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [],
  };
  (map.getSource(SRC_ROUTE) as GeoJSONSource | undefined)?.setData(data);
}

export function setStops(map: MLMap, stops: { position: LngLat; label: string }[]): void {
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: stops.map((s) => ({ type: 'Feature', properties: { label: s.label }, geometry: { type: 'Point', coordinates: s.position } })),
  };
  (map.getSource(SRC_STOPS) as GeoJSONSource | undefined)?.setData(data);
}

export function setIsolines(map: MLMap, isolines: { minutes: number; polygons: LngLat[][][] }[]): void {
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: isolines.map((iso) => ({
      type: 'Feature',
      properties: { minutes: iso.minutes },
      geometry: { type: 'MultiPolygon', coordinates: iso.polygons },
    })),
  };
  (map.getSource(SRC_ISO) as GeoJSONSource | undefined)?.setData(data);
}

export function fitTo(map: MLMap, coords: LngLat[], padding = 60): void {
  if (coords.length === 0) return;
  const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(bounds, { padding, maxZoom: 13, duration: 1200 });
}
