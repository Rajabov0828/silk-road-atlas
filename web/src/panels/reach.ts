import type { AppContext } from '../context';
import { CATEGORY_META } from '../config';
import { $, clear, h, toast } from '../dom';
import { sitesInside, topSites } from '../filters';
import { fitTo, setIsolines } from '../map';
import type { LngLat } from '../types';

const MINUTES = [15, 30, 60];

export function initReach(ctx: AppContext): void {
  const panel = $('#panel-reach');
  const output = h('div', { class: 'reach-output' });
  let picking = false;

  const pickBtn = h(
    'button',
    {
      class: 'btn',
      onclick: () => {
        picking = !picking;
        pickBtn.classList.toggle('active', picking);
        pickBtn.textContent = picking ? 'Click on the map…' : '📍 Pick a starting point on the map';
        ctx.map.getCanvas().style.cursor = picking ? 'crosshair' : '';
      },
    },
    '📍 Pick a starting point on the map',
  );
  const clearBtn = h(
    'button',
    {
      class: 'btn ghost',
      onclick: () => {
        setIsolines(ctx.map, []);
        clear(output);
      },
    },
    'Clear',
  );

  panel.append(
    h('p', { class: 'intro' }, 'Staying at a hotel or arriving at a station? Pick any point and see which heritage sites you can reach by car in 15, 30 and 60 minutes. The areas come from Amazon Location CalculateIsolines.'),
    h('div', { class: 'row' }, pickBtn, clearBtn),
    h(
      'div',
      { class: 'legend' },
      h('span', { class: 'swatch', style: 'background:#22c55e' }),
      '15 min ',
      h('span', { class: 'swatch', style: 'background:#eab308' }),
      '30 min ',
      h('span', { class: 'swatch', style: 'background:#f97316' }),
      '60 min',
    ),
    output,
  );

  ctx.map.on('click', (e) => {
    if (!picking) return;
    picking = false;
    pickBtn.classList.remove('active');
    pickBtn.textContent = '📍 Pick a starting point on the map';
    ctx.map.getCanvas().style.cursor = '';
    void run([e.lngLat.lng, e.lngLat.lat], 'selected point');
  });

  async function run(origin: LngLat, label: string): Promise<void> {
    ctx.showTab('reach');
    clear(output);
    output.append(h('div', { class: 'muted' }, `Calculating drive-time areas from ${label}…`));
    try {
      const res = await ctx.api.isoline(origin, MINUTES);
      setIsolines(ctx.map, res.isolines);
      const all = res.isolines.flatMap((i) => i.polygons.flatMap((p) => p[0] ?? []));
      fitTo(ctx.map, all.length ? all : [origin], 40);

      clear(output);
      output.append(h('h3', {}, `From ${label}`));
      const byMinutes = [...res.isolines].sort((a, b) => a.minutes - b.minutes);
      const grid = h('div', { class: 'stats-grid' });
      const widest = byMinutes[byMinutes.length - 1];
      for (const iso of byMinutes) {
        const inside = sitesInside(ctx.sites, iso.polygons);
        grid.append(h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, String(inside.length)), h('div', { class: 'stat-label' }, `sites ≤ ${iso.minutes} min`)));
      }
      output.append(grid);
      if (!widest) return;
      const reachable = topSites(sitesInside(ctx.sites, widest.polygons), 15);
      output.append(
        h('div', { class: 'muted small' }, `Top sites within ${widest.minutes} min:`),
        h(
          'ul',
          { class: 'site-list' },
          ...reachable.map((s) =>
            h(
              'li',
              {},
              h(
                'button',
                { class: 'site', onclick: () => (ctx.map.flyTo({ center: s.geometry.coordinates, zoom: 15 }), ctx.openSite(s)) },
                h('span', { class: 'dot', style: `background:${CATEGORY_META[s.properties.category].color}` }),
                h('span', { class: 'site-name' }, s.properties.name),
                s.properties.unesco ? h('span', { class: 'gold' }, '★') : null,
                h('span', { class: 'muted small' }, s.properties.city),
              ),
            ),
          ),
        ),
      );
    } catch (err) {
      clear(output);
      toast((err as Error).message, 'error');
    }
  }

  ctx.reachFrom = (origin, label) => void run(origin, label);
}
