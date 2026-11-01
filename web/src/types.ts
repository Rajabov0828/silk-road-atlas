export type Category =
  | 'caravanserai'
  | 'mausoleum'
  | 'mosque'
  | 'madrasa'
  | 'fortress'
  | 'archaeology'
  | 'museum'
  | 'monument'
  | 'attraction';

export type LngLat = [number, number];

export interface SiteProperties {
  id: string;
  name: string;
  name_en?: string;
  category: Category;
  city: string;
  unesco: boolean;
  wikipedia?: string;
  wikidata?: string;
  website?: string;
  start_date?: string;
  score: number;
}

export interface SiteFeature {
  type: 'Feature';
  id: number;
  geometry: { type: 'Point'; coordinates: LngLat };
  properties: SiteProperties;
}

export interface DatasetMetadata {
  source: string;
  license: string;
  osm_timestamp: string;
  count: number;
  by_category: Record<string, number>;
  by_city: Record<string, number>;
}

export interface SiteCollection {
  type: 'FeatureCollection';
  metadata: DatasetMetadata;
  features: SiteFeature[];
}

export interface RouteLeg {
  distance_m: number;
  duration_s: number;
  coordinates: LngLat[];
}

export interface RouteResult {
  order: number[];
  distance_m: number;
  duration_s: number;
  legs: RouteLeg[];
}

export interface IsolineResult {
  isolines: { minutes: number; polygons: LngLat[][][] }[];
}

export interface Place {
  title: string;
  label?: string | null;
  position: LngLat;
  place_type?: string | null;
}

export interface PlacesResult {
  results: Place[];
}
