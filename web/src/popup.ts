import * as maplibregl from 'maplibre-gl';
import type { Popup } from 'maplibre-gl';
import { CATEGORY_META } from './config';
import { h, toast, wikipediaUrl } from './dom';
import type { AppContext } from './context';
import type { SiteFeature } from './types';

let popup: Popup | null = null;
const addressCache = new Map<string, string>();

export function openSitePopup(ctx: AppContext, site: SiteFeature): void {
  const p = site.properties;
  const meta = CATEGORY_META[p.category];
  const wiki = wikipediaUrl(p.wikipedia);
  const address = h('div', { class: 'popup-address muted' }, 'Looking up addressвЂ¦');

  const tripBtn = h(
    'button',
    {
      class: 'btn small',
      onclick: () => {
        if (ctx.trip.has(p.id)) {
          ctx.trip.remove(p.id);
          tripBtn.textContent = 'вћ• Add to trip';
        } else if (ctx.trip.add(site)) {
          tripBtn.textContent = 'вњ“ In trip';
          toast(`Added вЂњ${p.name}вЂќ to your trip`);
        } else {
          toast('Trip is full (20 stops max)', 'error');
        }
      },
    },
    ctx.trip.has(p.id) ? 'вњ“ In trip' : 'вћ• Add to trip',
  );

  const content = h(
    'div',
    { class: 'popup' },
    h('div', { class: 'popup-cat', style: `color:${meta.color}` }, `${meta.icon} ${meta.label.replace(/s$/, '')}`),
    h('h3', {}, p.name),
    p.name_en && p.name_en !== p.name ? h('div', { class: 'muted' }, p.name_en) : null,
    h(
      'div',
      { class: 'chips' },
      h('span', { class: 'chip' }, `рџ“Ќ ${p.city}`),
      p.unesco ? h('span', { class: 'chip gold' }, 'в… UNESCO World Heritage') : null,
      p.start_date ? h('span', { class: 'chip' }, `рџ•° ${p.start_date}`) : null,
    ),
    address,
    h(
      'div',
      { class: 'links' },
      wiki ? h('a', { href: wiki, target: '_blank', rel: 'noopener noreferrer' }, 'Wikipedia в†—') : null,
      p.wikidata ? h('a', { href: `https://www.wikidata.org/wiki/${p.wikidata}`, target: '_blank', rel: 'noopener noreferrer' }, 'Wikidata в†—') : null,
      p.website ? h('a', { href: p.website, target: '_blank', rel: 'noopener noreferrer nofollow' }, 'Website в†—') : null,
      h('a', { href: `https://www.openstreetmap.org/${p.id}`, target: '_blank', rel: 'noopener noreferrer' }, 'OSM в†—'),
    ),
    h(
      'div',
      { class: 'actions' },
      tripBtn,
      h('button', { class: 'btn small ghost', onclick: () => ctx.reachFrom(site.geometry.coordinates, p.name) }, 'вЏ± Reachable from here'),
    ),
  );

  popup?.remove();
  const current = new maplibregl.Popup({ maxWidth: '320px', offset: 12 }).setLngLat(site.geometry.coordinates).setDOMContent(content).addTo(ctx.map);
  popup = current;
  history.replaceState(null, '', `#site=${encodeURIComponent(p.id)}`);
  current.on('close', () => history.replaceState(null, '', location.pathname));

  const cached = addressCache.get(p.id);
  if (cached) {
    address.textContent = cached;
    return;
  }
  ctx.api
    .reverse(site.geometry.coordinates)
    .then((res) => {
      const label = res.results[0]?.label ?? res.results[0]?.title ?? 'Address not available';
      addressCache.set(p.id, `рџЏ  ${label}`);
      address.textContent = `рџЏ  ${label}`;
    })
    .catch((err: Error) => {
      address.textContent = 'Address unavailable';
      console.warn('Reverse geocode failed', err.message);
    });
}
