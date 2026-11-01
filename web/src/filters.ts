import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { Category, LngLat, SiteFeature } from './types';

export interface FilterState {
  categories: Set<Category>;
  city: string | null;
  unescoOnly: boolean;
  text: string;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u02bb\u02bc'`’‘]/g, '')
    .trim();
}

export function matches(feature: SiteFeature, state: FilterState): boolean {
  const p = feature.properties;
  if (!state.categories.has(p.category)) return false;
  if (state.city && p.city !== state.city) return false;
  if (state.unescoOnly && !p.unesco) return false;
  if (state.text) {
    const needle = normalize(state.text);
    const haystack = normalize(`${p.name} ${p.name_en ?? ''} ${p.city}`);
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function applyFilters(features: SiteFeature[], state: FilterState): SiteFeature[] {
  return features.filter((f) => matches(f, state));
}

/** Sites inside any of the given polygons (each polygon = list of rings). */
export function sitesInside(features: SiteFeature[], polygons: LngLat[][][]): SiteFeature[] {
  if (polygons.length === 0) return [];
  const geometry = { type: 'MultiPolygon' as const, coordinates: polygons };
  return features.filter((f) => booleanPointInPolygon(f.geometry.coordinates, geometry));
}

export function topSites(features: SiteFeature[], limit: number): SiteFeature[] {
  return [...features].sort((a, b) => b.properties.score - a.properties.score || a.properties.name.localeCompare(b.properties.name)).slice(0, limit);
}
