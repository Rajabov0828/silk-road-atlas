import type { AppContext } from '../context';
import { caravanDays, formatDistance, formatDuration } from '../caravan';
import { $, clear, h, toast } from '../dom';
import { fitTo, setRoute, setStops } from '../map';
import { CATEGORY_META } from '../config';
import { sitesNearRoute } from '../filters';
import type { RouteLeg, SiteFeature } from '../types';

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
    h(
      'p',
      { class: 'intro' },
      'Click any site on the map and press “Add to trip”. With 2 or more stops, Amazon Location Service finds a good visiting order (first and last stay fixed) and routes it on real roads.',
    ),
    list,
    h('label', { class: 'toggle' }, optimize, ' Optimize stop order (OptimizeWaypoints)'),
    h('div', { class: 'row' }, routeBtn, clearBtn),
    result,
  );

  function exportGpx(items: readonly SiteFeature[], legs: RouteLeg[]): void {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Silk Road Atlas" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Silk Road Atlas Itinerary</name>
    <desc>Optimized cultural heritage route via Amazon Location Service</desc>
  </metadata>
  ${items
    .map(
      (s, i) => `
  <wpt lat="${s.geometry.coordinates[1]}" lon="${s.geometry.coordinates[0]}">
    <name>${i + 1}. ${s.properties.name}</name>
    <desc>${s.properties.city} (${s.properties.category})</desc>
  </wpt>`,
    )
    .join('')}
  <trk>
    <name>Silk Road Driving Route</name>
    <trkseg>
      ${legs
        .flatMap((l) => l.coordinates)
        .map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"/>`)
        .join('\n      ')}
    </trkseg>
  </trk>
</gpx>`;
    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'silk-road-itinerary.gpx';
    a.click();
    URL.revokeObjectURL(url);
    toast('GPX file downloaded! You can import it into OsmAnd, Garmin, or Google Earth.');
  }

  function openGoogleMaps(items: readonly SiteFeature[]): void {
    if (items.length < 2) return;
    const origin = `${items[0].geometry.coordinates[1]},${items[0].geometry.coordinates[0]}`;
    const dest = `${items[items.length - 1].geometry.coordinates[1]},${items[items.length - 1].geometry.coordinates[0]}`;
    const waypoints = items
      .slice(1, -1)
      .map((s) => `${s.geometry.coordinates[1]},${s.geometry.coordinates[0]}`)
      .join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? `&waypoints=${waypoints}` : ''}`;
    window.open(url, '_blank');
  }

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
    routeBtn.textContent = 'Routing with Amazon Location…';
    try {
      const r = await ctx.api.route(positions, optimize.checked);
      ctx.trip.reorder(r.order);
      setRoute(ctx.map, r.legs);
      const allCoords = r.legs.flatMap((l) => l.coordinates);
      fitTo(ctx.map, allCoords);
      clear(result);

      // Along-route discovery
      const nearby = sitesNearRoute(
        ctx.sites.filter((s) => !ctx.trip.has(s.properties.id)),
        allCoords,
        10,
        5,
      );

      const alongCard =
        nearby.length > 0
          ? h(
              'div',
              { class: 'along-card', style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-top:8px;' },
              h('strong', { style: 'font-size:12px; color:#1d4ed8; display:block; margin-bottom:6px;' }, `🐫 Discovered Along Route (${nearby.length})`),
              h(
                'ul',
                { class: 'site-list' },
                ...nearby.map((s) =>
                  h(
                    'li',
                    { style: 'display:flex; align-items:center; justify-content:space-between; gap:6px; font-size:12px;' },
                    h('button', { class: 'link', style: 'flex:1;', onclick: () => ctx.openSite(s) }, `${CATEGORY_META[s.properties.category].icon} ${s.properties.name}`),
                    h(
                      'button',
                      {
                        class: 'btn small ghost',
                        style: 'padding:2px 8px; font-size:11px;',
                        onclick: () => {
                          ctx.trip.add(s);
                          void calculate();
                        },
                      },
                      '+ Add',
                    ),
                  ),
                ),
              ),
            )
          : null;

      result.append(
        h(
          'div',
          { class: 'stats-grid' },
          h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, formatDistance(r.distance_m)), h('div', { class: 'stat-label' }, 'Total distance')),
          h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, formatDuration(r.duration_s)), h('div', { class: 'stat-label' }, 'Driving time')),
          h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, `≈ ${caravanDays(r.distance_m)} d`), h('div', { class: 'stat-label' }, 'By caravan')),
        ),
        h(
          'div',
          { class: 'row', style: 'margin: 6px 0;' },
          h('button', { class: 'btn small ghost', onclick: () => exportGpx(ctx.trip.items, r.legs) }, '📥 Export GPX'),
          h('button', { class: 'btn small ghost', onclick: () => openGoogleMaps(ctx.trip.items) }, '🗺️ Open in Google Maps'),
        ),
        h(
          'ol',
          { class: 'legs' },
          ...r.legs.map((leg, i) =>
            h('li', {}, `${ctx.trip.items[i]?.properties.name ?? '?'} → ${ctx.trip.items[i + 1]?.properties.name ?? '?'}: ${formatDistance(leg.distance_m)}, ${formatDuration(leg.duration_s)}`),
          ),
        ),
      );
      if (alongCard) {
        result.append(alongCard);
      }
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
