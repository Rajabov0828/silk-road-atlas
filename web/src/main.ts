import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import type { MapGeoJSONFeature } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { createApi } from './api';
import { loadConfig } from './config';
import { TripStore, type AppContext } from './context';
import { $, h, toast } from './dom';
import { SRC_SITES, addLayers, createMap } from './map';
import { initExplore } from './panels/explore';
import { initReach } from './panels/reach';
import { initStory } from './panels/story';
import { initTrip } from './panels/trip';
import { closeSiteDrawer, openSitePopup } from './popup';
import type { SiteCollection, SiteFeature } from './types';

type Tab = 'explore' | 'story' | 'trip' | 'reach';

async function loadSites(): Promise<SiteCollection> {
  const res = await fetch('/data/heritage.geojson');
  if (!res.ok) throw new Error(`Failed to load dataset (${res.status})`);
  const data = (await res.json()) as SiteCollection;
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Dataset has an unexpected format');
  return data;
}

function showTab(tab: Tab): void {
  document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll<HTMLElement>('.panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${tab}`));
  $('#sidebar').classList.remove('collapsed');
}

function renderStats(data: SiteCollection): void {
  const unesco = data.features.filter((f) => f.properties.unesco).length;
  const caravanserais = data.metadata.by_category.caravanserai ?? 0;
  const el = $('#stats');
  el.append(
    h(
      'div',
      { class: 'stat-box' },
      h('div', { class: 'stat-header' }, h('span', { class: 'stat-icon' }, '🏛️'), h('strong', {}, data.metadata.count.toLocaleString())),
      h('span', { class: 'stat-label' }, 'Heritage Sites'),
    ),
    h(
      'div',
      { class: 'stat-box' },
      h('div', { class: 'stat-header' }, h('span', { class: 'stat-icon' }, '★'), h('strong', {}, String(unesco))),
      h('span', { class: 'stat-label' }, 'In UNESCO Zones'),
    ),
    h(
      'div',
      { class: 'stat-box' },
      h('div', { class: 'stat-header' }, h('span', { class: 'stat-icon' }, '🐫'), h('strong', {}, String(caravanserais))),
      h('span', { class: 'stat-label' }, 'Caravanserais'),
    ),
  );
  el.title = `OpenStreetMap snapshot: ${data.metadata.osm_timestamp}`;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.mapsApiKey) toast('VITE_LOCATION_API_KEY is not set — running without a base map.', 'error');

  const map = createMap('map', cfg);
  const api = createApi(cfg.apiBase);
  const [data] = await Promise.all([
    loadSites(),
    new Promise<void>((resolve) => {
      map.once('load', () => resolve());
      map.once('error', (e) => {
        console.warn('Map notice:', e);
        resolve();
      });
      setTimeout(() => resolve(), 3000);
    }),
  ]);
  const byId = new Map<string, SiteFeature>(data.features.map((f) => [f.properties.id, f]));

  addLayers(map);
  renderStats(data);

  const ctx: AppContext = {
    map,
    api,
    sites: data.features,
    trip: new TripStore(),
    showTab,
    openSite: (site) => openSitePopup(ctx, site),
    reachFrom: () => undefined, // replaced by initReach
  };

  document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab as Tab)));
  $('#toggle-sidebar').addEventListener('click', () => $('#sidebar').classList.toggle('collapsed'));

  initExplore(ctx);
  initStory(ctx);
  initTrip(ctx);
  initReach(ctx);

  map.on('click', 'clusters', async (e) => {
    const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
    if (!feature) return;
    const source = map.getSource(SRC_SITES) as GeoJSONSource;
    const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
    map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
  });
  map.on('click', 'site-points', (e) => {
    const id = e.features?.[0]?.properties?.id as string | undefined;
    const site = id ? byId.get(id) : undefined;
    if (site) ctx.openSite(site);
  });
  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: ['site-points', 'clusters'] });
    if (hits.length === 0) {
      closeSiteDrawer();
    }
  });
  for (const layer of ['clusters', 'site-points']) {
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
  }

  // Deep link: #site=way/123
  const match = /^#site=(.+)$/.exec(location.hash);
  const linked = match ? byId.get(decodeURIComponent(match[1])) : undefined;
  if (linked) {
    map.jumpTo({ center: linked.geometry.coordinates, zoom: 15 });
    ctx.openSite(linked);
  }
}

main().catch((err: Error) => {
  console.error(err);
  toast(`Failed to start: ${err.message}`, 'error');
});
