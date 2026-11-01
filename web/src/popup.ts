import * as maplibregl from 'maplibre-gl';
import type { Popup } from 'maplibre-gl';
import { stopSpeaking, toggleAudioGuide } from './audio';
import { CATEGORY_META } from './config';
import { clear, h, toast, wikipediaUrl } from './dom';
import type { AppContext } from './context';
import type { SiteFeature } from './types';
import { getSiteSummary } from './wiki';

let popup: Popup | null = null;
const addressCache = new Map<string, string>();

export function openSitePopup(ctx: AppContext, site: SiteFeature): void {
  const p = site.properties;
  const meta = CATEGORY_META[p.category];
  const wiki = wikipediaUrl(p.wikipedia);

  // Dynamic Elements
  const imageContainer = h(
    'div',
    { class: 'popup-image-container' },
    h('div', { class: 'popup-image-skeleton' }, 'Loading photo…'),
    p.unesco ? h('div', { class: 'popup-unesco-pill' }, '★ UNESCO World Heritage') : null,
  );

  const address = h('div', { class: 'popup-address muted' }, 'Looking up address via Amazon Location…');
  const description = h('p', { class: 'popup-desc muted' }, 'Fetching historical overview…');

  const tripBtn = h(
    'button',
    {
      class: 'btn small',
      onclick: () => {
        if (ctx.trip.has(p.id)) {
          ctx.trip.remove(p.id);
          tripBtn.textContent = '+ Add to trip';
        } else if (ctx.trip.add(site)) {
          tripBtn.textContent = '✓ In trip';
          toast(`Added "${p.name}" to your trip`);
        } else {
          toast('Trip is full (maximum 20 stops)', 'error');
        }
      },
    },
    ctx.trip.has(p.id) ? '✓ In trip' : '+ Add to trip',
  );

  const audioBtn = h(
    'button',
    {
      class: 'btn small ghost audio-btn',
      onclick: () => {
        const narration = `${p.name}, in ${p.city}, Uzbekistan. ${description.textContent}`;
        toggleAudioGuide(narration, audioBtn);
      },
    },
    '🎧 Audio Guide',
  );

  const content = h(
    'div',
    { class: 'popup' },
    imageContainer,
    h(
      'div',
      { class: 'popup-body' },
      h(
        'div',
        { class: 'popup-header' },
        h('div', { class: 'popup-cat', style: `color:${meta.color}` }, `${meta.icon} ${meta.label.replace(/s$/, '')}`),
        h('h3', {}, p.name),
        p.name_en && p.name_en !== p.name ? h('div', { class: 'popup-subtitle' }, p.name_en) : null,
      ),
      h(
        'div',
        { class: 'chips' },
        h('span', { class: 'chip' }, `📍 ${p.city}`),
        p.unesco ? h('span', { class: 'chip unesco' }, '★ UNESCO World Heritage') : null,
        p.start_date ? h('span', { class: 'chip' }, `🕰 Built: ${p.start_date}`) : null,
      ),
      description,
      address,
      h(
        'div',
        { class: 'links' },
        wiki ? h('a', { href: wiki, target: '_blank', rel: 'noopener noreferrer' }, 'Wikipedia ↗') : null,
        p.wikidata ? h('a', { href: `https://www.wikidata.org/wiki/${p.wikidata}`, target: '_blank', rel: 'noopener noreferrer' }, 'Wikidata ↗') : null,
        p.website ? h('a', { href: p.website, target: '_blank', rel: 'noopener noreferrer nofollow' }, 'Website ↗') : null,
        h('a', { href: `https://www.openstreetmap.org/${p.id}`, target: '_blank', rel: 'noopener noreferrer' }, 'OpenStreetMap ↗'),
      ),
      h(
        'div',
        { class: 'actions' },
        tripBtn,
        audioBtn,
        h('button', { class: 'btn small ghost', onclick: () => ctx.reachFrom(site.geometry.coordinates, p.name) }, '⏱ Drive-time area'),
      ),
    ),
  );

  popup?.remove();
  const current = new maplibregl.Popup({ maxWidth: '380px', offset: 14, className: 'rich-site-popup' })
    .setLngLat(site.geometry.coordinates)
    .setDOMContent(content)
    .addTo(ctx.map);
  popup = current;
  history.replaceState(null, '', `#site=${encodeURIComponent(p.id)}`);
  current.on('close', () => {
    stopSpeaking();
    history.replaceState(null, '', location.pathname);
  });

  // Asynchronously load real site photography and summary
  getSiteSummary(p).then((summary) => {
    clear(imageContainer);
    if (summary.imageUrl) {
      const img = document.createElement('img');
      img.src = summary.imageUrl;
      img.alt = p.name;
      img.className = 'popup-photo';
      img.loading = 'lazy';
      imageContainer.appendChild(img);
    }
    if (p.unesco) {
      imageContainer.appendChild(h('div', { class: 'popup-unesco-pill' }, '★ UNESCO World Heritage'));
    }
    if (summary.extract) {
      description.textContent = summary.extract;
      description.classList.remove('muted');
    } else {
      description.textContent = `Cultural heritage landmark located in ${p.city}, Uzbekistan along the ancient Silk Road trading route.`;
      description.classList.remove('muted');
    }
  });

  // Asynchronously resolve address via Amazon Location Places ReverseGeocode
  const cached = addressCache.get(p.id);
  if (cached) {
    address.textContent = cached;
    return;
  }
  ctx.api
    .reverse(site.geometry.coordinates)
    .then((res) => {
      const label = res.results[0]?.label ?? res.results[0]?.title ?? 'Location in ' + p.city;
      const formatted = `🏠 ${label}`;
      addressCache.set(p.id, formatted);
      address.textContent = formatted;
    })
    .catch((err: Error) => {
      address.textContent = `📍 ${p.city}, Uzbekistan`;
      console.warn('Reverse geocode note:', err.message);
    });
}
