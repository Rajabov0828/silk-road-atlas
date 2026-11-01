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

/** Find heritage sites within maxKm of a routed polyline. */
export function sitesNearRoute(features: SiteFeature[], routeCoords: LngLat[], maxKm = 8, limit = 8): SiteFeature[] {
  if (routeCoords.length === 0 || features.length === 0) return [];

  const step = Math.max(1, Math.floor(routeCoords.length / 100));
  const sampled: LngLat[] = [];
  for (let i = 0; i < routeCoords.length; i += step) {
    sampled.push(routeCoords[i]);
  }
  sampled.push(routeCoords[routeCoords.length - 1]);

  const maxDeg = maxKm / 111.0;
  const maxDegSq = maxDeg * maxDeg;

  const nearby: { site: SiteFeature; distSq: number }[] = [];

  for (const f of features) {
    const [sx, sy] = f.geometry.coordinates;
    let minDistSq = Infinity;

    for (const [rx, ry] of sampled) {
      const dx = (sx - rx) * Math.cos((sy * Math.PI) / 180);
      const dy = sy - ry;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDistSq) minDistSq = d2;
      if (minDistSq <= maxDegSq) break;
    }

    if (minDistSq <= maxDegSq) {
      nearby.push({ site: f, distSq: minDistSq });
    }
  }

  // Prioritize caravanserais and UNESCO monuments
  nearby.sort((a, b) => {
    const aPri = (a.site.properties.category === 'caravanserai' ? 5 : 0) + (a.site.properties.unesco ? 3 : 0);
    const bPri = (b.site.properties.category === 'caravanserai' ? 5 : 0) + (b.site.properties.unesco ? 3 : 0);
    if (aPri !== bPri) return bPri - aPri;
    return b.site.properties.score - a.site.properties.score;
  });

  return nearby.slice(0, limit).map((n) => n.site);
}
