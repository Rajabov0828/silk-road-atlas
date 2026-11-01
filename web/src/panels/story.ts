import type { AppContext } from '../context';
import { caravanDays, formatDistance, formatDuration, speedup } from '../caravan';
import { $, clear, h, toast } from '../dom';
import { fitTo, setRoute, setStops } from '../map';
import { STORY } from '../story';
import type { RouteResult } from '../types';

export function initStory(ctx: AppContext): void {
  const panel = $('#panel-story');
  const body = h('div', { class: 'story-body' });
  const progress = h('div', { class: 'progress' }, ...STORY.map(() => h('span', {})));
  const prev = h('button', { class: 'btn ghost', onclick: () => go(step - 1) }, '← Back');
  const next = h('button', { class: 'btn', onclick: () => go(step + 1) }, 'Start the journey →');

  let step = -1;
  let route: RouteResult | null = null;
  let loading: Promise<RouteResult | null> | null = null;

  panel.append(
    h(
      'p',
      { class: 'intro' },
      'Follow a caravan across Uzbekistan, from the silk workshops of the Fergana Valley to Khiva, the last oasis before the Karakum desert. ',
      'Every leg is routed on today’s roads with Amazon Location Service and compared with a caravan moving about 30 km a day.',
    ),
    progress,
    body,
    h('div', { class: 'row' }, prev, next),
  );
  prev.disabled = true;

  async function ensureRoute(): Promise<RouteResult | null> {
    if (route) return route;
    loading ??= ctx.api
      .route(
        STORY.map((s) => s.position),
        false,
      )
      .then((r) => (route = r))
      .catch((err: Error) => {
        toast(`Could not load the route: ${err.message}`, 'error');
        loading = null;
        return null;
      });
    return loading;
  }

  function stat(label: string, value: string, hint?: string): HTMLElement {
    return h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-label' }, label), hint ? h('div', { class: 'muted small' }, hint) : null);
  }

  async function go(target: number): Promise<void> {
    if (target < 0 || target > STORY.length) return;
    step = target;
    prev.disabled = step <= 0;
    next.disabled = step >= STORY.length;
    next.textContent = step >= STORY.length - 1 ? 'Show the whole journey →' : 'Next stop →';
    [...progress.children].forEach((el, i) => el.classList.toggle('done', i <= step));

    const r = await ensureRoute();
    clear(body);

    if (step === STORY.length) {
      showSummary(r);
      return;
    }

    const stop = STORY[step];
    setStops(
      ctx.map,
      STORY.slice(0, step + 1).map((s, i) => ({ position: s.position, label: String(i + 1) })),
    );
    setRoute(ctx.map, r ? r.legs.slice(0, step) : null);
    ctx.map.flyTo({ center: stop.position, zoom: stop.zoom, speed: 0.8, curve: 1.6, essential: true });

    const leg = r && step > 0 ? r.legs[step - 1] : null;
    const imgCard = h(
      'div',
      { class: 'story-image-card' },
      h('img', { src: stop.imageUrl, alt: stop.city, loading: 'lazy' }),
      h('div', { class: 'story-image-badge' }, stop.imageCaption),
    );

    body.append(
      h('div', { class: 'eyebrow' }, `Stop ${step + 1} of ${STORY.length} · ${stop.era}`),
      h('h2', {}, stop.city),
      imgCard,
      h('p', {}, stop.text),
      leg
        ? h(
            'div',
            { class: 'stats-grid' },
            stat(`From ${STORY[step - 1].city}`, formatDistance(leg.distance_m)),
            stat('By car today', formatDuration(leg.duration_s)),
            stat('By caravan', `≈ ${caravanDays(leg.distance_m)} days`),
          )
        : h('div', { class: 'muted small' }, 'The caravan loads up its silk here.'),
      h(
        'button',
        {
          class: 'btn small ghost',
          onclick: () => {
            ctx.showTab('explore');
            $('#panel-explore').dispatchEvent(new CustomEvent('explore:text', { detail: stop.city }));
          },
        },
        `🔍 Explore heritage sites in ${stop.city}`,
      ),
    );
  }

  function showSummary(r: RouteResult | null): void {
    setStops(
      ctx.map,
      STORY.map((s, i) => ({ position: s.position, label: String(i + 1) })),
    );
    setRoute(ctx.map, r?.legs ?? null);
    fitTo(
      ctx.map,
      STORY.map((s) => s.position),
      80,
    );
    if (!r) return;
    const days = caravanDays(r.distance_m);
    body.append(
      h('div', { class: 'eyebrow' }, 'The whole journey'),
      h('h2', {}, `${STORY[0].city} → ${STORY[STORY.length - 1].city}`),
      h(
        'div',
        { class: 'stats-grid' },
        stat('Road distance', formatDistance(r.distance_m)),
        stat('By car today', formatDuration(r.duration_s)),
        stat('By caravan', `≈ ${days} days`, `about ${Math.round(days / 7)} weeks`),
      ),
      h(
        'p',
        { class: 'highlight' },
        `A car covers this route about ${speedup(r.distance_m, r.duration_s)}× faster than a camel caravan. The ${STORY.length} cities along it are still lined with madrasas, mausoleums and caravanserais. Open the Trip tab to plan your own route.`,
      ),
    );
  }
}
