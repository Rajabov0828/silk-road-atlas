import type { AppContext } from '../context';
import { caravanDays, formatDistance, formatDuration } from '../caravan';
import { $, clear, h, toast } from '../dom';
import { fitTo, setRoute, setStops } from '../map';
import { CATEGORY_META } from '../config';

export function initTrip(ctx: AppContext): void {
  const panel = $('#panel-trip');
  const list = h('ol', { class: 'trip-list' });
  const result = h('div', { class: 'trip-result' });
  const optimize = h('input', { type: 'checkbox', checked: true });
  const routeBtn = h('button', { class: 'btn', onclick: () => void calculate() }, '🧭 Route my trip');
  const clearBtn = h(
    'button',
    {
      class: 'btn ghost',
      onclick: () => {
        ctx.trip.clear();
        setRoute(ctx.map, null);
        setStops(ctx.map, []);
        clear(result);
      },
    },
    'Clear',
  );

  panel.append(
    h('p', { class: 'intro' }, 'Click any site on the map and press “Add to trip”. With 2 or more stops, Amazon Location Service finds a good visiting order (first and last stay fixed) and routes it on real roads.'),
    list,
    h('label', { class: 'toggle' }, optimize, ' Optimize stop order (OptimizeWaypoints)'),
    h('div', { class: 'row' }, routeBtn, clearBtn),
    result,
  );

  function render(): void {
    $('#trip-count').textContent = String(ctx.trip.items.length);
    clear(list);
    if (ctx.trip.items.length === 0) {
      list.append(h('li', { class: 'muted' }, 'No stops yet.'));
    }
    ctx.trip.items.forEach((site, i) => {
      const meta = CATEGORY_META[site.properties.category];
      list.append(
        h(
          'li',
          {},
          h('span', { class: 'num' }, String(i + 1)),
          h('button', { class: 'link', onclick: () => ctx.openSite(site) }, `${meta.icon} ${site.properties.name}`),
          h('span', { class: 'muted small' }, site.properties.city),
          h('button', { class: 'icon-btn', 'aria-label': `Remove ${site.properties.name}`, onclick: () => ctx.trip.remove(site.properties.id) }, '✕'),
        ),
      );
    });
    routeBtn.disabled = ctx.trip.items.length < 2;
    setStops(
      ctx.map,
      ctx.trip.items.map((s, i) => ({ position: s.geometry.coordinates, label: String(i + 1) })),
    );
  }

  async function calculate(): Promise<void> {
    const positions = ctx.trip.positions();
    if (positions.length < 2) return;
    routeBtn.disabled = true;
    routeBtn.textContent = 'Routing…';
    try {
      const r = await ctx.api.route(positions, optimize.checked);
      ctx.trip.reorder(r.order);
      setRoute(ctx.map, r.legs);
      fitTo(ctx.map, r.legs.flatMap((l) => l.coordinates));
      clear(result);
      result.append(
        h(
          'div',
          { class: 'stats-grid' },
          h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, formatDistance(r.distance_m)), h('div', { class: 'stat-label' }, 'Total distance')),
          h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, formatDuration(r.duration_s)), h('div', { class: 'stat-label' }, 'Driving time')),
          h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, `≈ ${caravanDays(r.distance_m)} d`), h('div', { class: 'stat-label' }, 'By caravan')),
        ),
        h(
          'ol',
          { class: 'legs' },
          ...r.legs.map((leg, i) =>
            h('li', {}, `${ctx.trip.items[i]?.properties.name ?? '?'} → ${ctx.trip.items[i + 1]?.properties.name ?? '?'}: ${formatDistance(leg.distance_m)}, ${formatDuration(leg.duration_s)}`),
          ),
        ),
      );
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      routeBtn.textContent = '🧭 Route my trip';
      routeBtn.disabled = ctx.trip.items.length < 2;
    }
  }

  ctx.trip.subscribe(render);
  render();
}
