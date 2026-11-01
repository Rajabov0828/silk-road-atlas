import { describe, expect, it } from 'vitest';
import { caravanDays, formatDistance, formatDuration, speedup } from '../src/caravan';
import { applyFilters, normalize, sitesInside, sitesNearRoute, topSites, type FilterState } from '../src/filters';
import { amazonStyleUrl, loadConfig } from '../src/config';
import type { Category, SiteFeature } from '../src/types';

function site(id: number, lon: number, lat: number, props: Partial<SiteFeature['properties']> = {}): SiteFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { id: `node/${id}`, name: `Site ${id}`, category: 'mosque', city: 'Bukhara', unesco: false, score: 0, ...props },
  };
}

const ALL: Category[] = ['caravanserai', 'mausoleum', 'mosque', 'madrasa', 'fortress', 'archaeology', 'museum', 'monument', 'attraction'];
const baseState = (): FilterState => ({ categories: new Set(ALL), city: null, unescoOnly: false, text: '' });

describe('caravan maths', () => {
  it('converts distance to caravan days', () => {
    expect(caravanDays(300_000)).toBe(10);
    expect(caravanDays(5_000)).toBe(1);
    expect(caravanDays(0)).toBe(0);
    expect(caravanDays(Number.NaN)).toBe(0);
    expect(() => caravanDays(1000, 0)).toThrow(RangeError);
  });

  it('formats distance and duration', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(2_345)).toBe('2.3 km');
    expect(formatDistance(1_234_000)).toBe('1,234 km');
    expect(formatDuration(59 * 60)).toBe('59 min');
    expect(formatDuration(2 * 3600)).toBe('2 h');
    expect(formatDuration(3 * 3600 + 25 * 60)).toBe('3 h 25 min');
    expect(formatDuration(-1)).toBe('—');
  });

  it('computes speed-up vs caravan', () => {
    // 300 km: caravan 10 days = 864000 s; car 4 h = 14400 s → 60×
    expect(speedup(300_000, 14_400)).toBe(60);
    expect(speedup(0, 100)).toBe(0);
  });
});

describe('filters', () => {
  const sites = [
    site(1, 64.41, 39.77, { name: 'Poi Kalyan', category: 'madrasa', unesco: true, score: 9 }),
    site(2, 66.97, 39.65, { name: 'Registan', city: 'Samarkand', category: 'madrasa', score: 10 }),
    site(3, 60.36, 41.37, { name: 'Ko‘hna Ark', city: 'Khiva', category: 'fortress', score: 3 }),
  ];

  it('filters by category, city, unesco and text', () => {
    expect(applyFilters(sites, { ...baseState(), categories: new Set(['fortress']) })).toHaveLength(1);
    expect(applyFilters(sites, { ...baseState(), city: 'Samarkand' })[0].properties.name).toBe('Registan');
    expect(applyFilters(sites, { ...baseState(), unescoOnly: true })).toHaveLength(1);
    expect(applyFilters(sites, { ...baseState(), text: 'kohna' })).toHaveLength(1);
  });

  it('normalizes Uzbek apostrophes and diacritics', () => {
    expect(normalize('Ko‘hna  ')).toBe('kohna');
    expect(normalize('Gʻijduvon')).toBe('gijduvon');
  });

  it('finds sites inside polygons', () => {
    const square = [[[64, 39], [65, 39], [65, 40], [64, 40], [64, 39]]] as [number, number][][];
    expect(sitesInside(sites, [square]).map((s) => s.id)).toEqual([1]);
    expect(sitesInside(sites, [])).toEqual([]);
  });

  it('ranks top sites by score', () => {
    expect(topSites(sites, 2).map((s) => s.id)).toEqual([2, 1]);
  });

  it('finds sites near a route polyline', () => {
    const route: [number, number][] = [
      [64.4, 39.75],
      [64.42, 39.77],
      [64.45, 39.79],
    ];
    const near = sitesNearRoute(sites, route, 10);
    expect(near.map((s) => s.id)).toContain(1); // Poi Kalyan is in Bukhara near [64.41, 39.77]
    expect(near.map((s) => s.id)).not.toContain(3); // Khiva is ~450km away
  });
});

describe('config', () => {
  it('builds the Amazon Location style URL only when a key exists', () => {
    expect(amazonStyleUrl(loadConfig({}), 'Standard', true)).toBeNull();
    const url = amazonStyleUrl(loadConfig({ VITE_LOCATION_API_KEY: 'v1.public.abc', VITE_AWS_REGION: 'eu-west-1' }), 'Standard', true);
    expect(url).toBe('https://maps.geo.eu-west-1.amazonaws.com/v2/styles/Standard/descriptor?key=v1.public.abc&color-scheme=Dark');
  });

  it('defaults api base and strips trailing slash', () => {
    expect(loadConfig({}).apiBase).toBe('/api');
    expect(loadConfig({ VITE_API_BASE: 'https://x.example/api/' }).apiBase).toBe('https://x.example/api');
  });
});
