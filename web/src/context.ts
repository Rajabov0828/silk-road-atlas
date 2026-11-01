import type { Map as MLMap } from 'maplibre-gl';
import type { Api } from './api';
import type { LngLat, SiteFeature } from './types';

export const MAX_TRIP_STOPS = 20;

type Listener = () => void;

/** Ordered list of sites the user wants to visit. */
export class TripStore {
  private stops: SiteFeature[] = [];
  private listeners: Listener[] = [];

  get items(): readonly SiteFeature[] {
    return this.stops;
  }

  has(id: string): boolean {
    return this.stops.some((s) => s.properties.id === id);
  }

  add(site: SiteFeature): boolean {
    if (this.has(site.properties.id) || this.stops.length >= MAX_TRIP_STOPS) return false;
    this.stops = [...this.stops, site];
    this.emit();
    return true;
  }

  remove(id: string): void {
    this.stops = this.stops.filter((s) => s.properties.id !== id);
    this.emit();
  }

  reorder(order: number[]): void {
    if (order.length !== this.stops.length) return;
    this.stops = order.map((i) => this.stops[i]);
    this.emit();
  }

  clear(): void {
    this.stops = [];
    this.emit();
  }

  positions(): LngLat[] {
    return this.stops.map((s) => s.geometry.coordinates);
  }

  subscribe(fn: Listener): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export interface AppContext {
  map: MLMap;
  api: Api;
  sites: SiteFeature[];
  trip: TripStore;
  showTab: (tab: 'explore' | 'story' | 'trip' | 'reach') => void;
  openSite: (site: SiteFeature) => void;
  reachFrom: (origin: LngLat, label: string) => void;
}
