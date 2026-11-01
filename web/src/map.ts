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

export function createMap(container: string, cfg: AppConfig): MLMap {
  const styleUrl = amazonStyleUrl(cfg, 'Standard', true);
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
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
  map.addControl(new maplibregl.FullscreenControl(), 'top-right');
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
      'fill-color': ['interpolate', ['linear'], ['get', 'minutes'], 15, '#22c55e', 30, '#eab308', 60, '#f97316', 120, '#ef4444'],
      'fill-opacity': 0.18,
    },
  });
  map.addLayer({
    id: 'iso-line',
    type: 'line',
    source: SRC_ISO,
    paint: { 'line-color': '#fde68a', 'line-width': 1.2, 'line-opacity': 0.7 },
  });

  map.addSource(SRC_ROUTE, { type: 'geojson', data: empty, lineMetrics: true });
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: SRC_ROUTE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#0b0f17', 'line-width': 8, 'line-opacity': 0.8 },
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: SRC_ROUTE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-width': 4.5,
      'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#fbbf24', 0.5, '#f97316', 1, '#e11d48'],
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
      'circle-color': ['step', ['get', 'point_count'], '#b45309', 20, '#d97706', 100, '#f59e0b'],
      'circle-radius': ['step', ['get', 'point_count'], 16, 20, 22, 100, 30],
      'circle-stroke-width': ['case', ['>', ['get', 'unesco'], 0], 3, 1.5],
      'circle-stroke-color': ['case', ['>', ['get', 'unesco'], 0], '#fde047', '#fff7ed'],
      'circle-opacity': 0.9,
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
    paint: { 'text-color': '#1c1917' },
  });
  map.addLayer({
    id: 'site-points',
    type: 'circle',
    source: SRC_SITES,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': categoryColorExpression(),
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 14, 8],
      'circle-stroke-width': ['case', ['get', 'unesco'], 2.5, 1],
      'circle-stroke-color': ['case', ['get', 'unesco'], '#fde047', '#0b0f17'],
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
    paint: { 'text-color': '#fef3c7', 'text-halo-color': '#0b0f17', 'text-halo-width': 1.4 },
  });

  map.addSource(SRC_STOPS, { type: 'geojson', data: empty });
  map.addLayer({
    id: 'stops',
    type: 'circle',
    source: SRC_STOPS,
    paint: { 'circle-radius': 11, 'circle-color': '#fbbf24', 'circle-stroke-color': '#0b0f17', 'circle-stroke-width': 2 },
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
    paint: { 'text-color': '#0b0f17' },
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
