import { CATEGORY_META } from '../config';
import type { AppContext } from '../context';
import { $, clear, h, toast } from '../dom';
import { applyFilters, normalize, topSites, type FilterState } from '../filters';
import { fitTo, setSites } from '../map';
import type { Category, Place, SiteFeature } from '../types';

const LIST_LIMIT = 60;

export function initExplore(ctx: AppContext): void {
  const panel = $('#panel-explore');
  const allCategories = Object.keys(CATEGORY_META) as Category[];
  const state: FilterState = { categories: new Set(allCategories), city: null, unescoOnly: false, text: '' };

  const cities = [...new Set(ctx.sites.map((s) => s.properties.city))].sort((a, b) =>
    a === 'Countryside' ? 1 : b === 'Countryside' ? -1 : a.localeCompare(b),
  );
  const counts = new Map<Category, number>();
  ctx.sites.forEach((s) => counts.set(s.properties.category, (counts.get(s.properties.category) ?? 0) + 1));

  const searchInput = h('input', { type: 'search', placeholder: 'Search sites or any place in Uzbekistan…', maxlength: 120, 'aria-label': 'Search' });
  const placeResults = h('div', { class: 'place-results' });
  const resultInfo = h('div', { class: 'muted small' });
  const list = h('ul', { class: 'site-list' });

  const citySelect = h(
    'select',
    {
      'aria-label': 'City',
      onchange: () => {
        state.city = citySelect.value || null;
        refresh(true);
      },
    },
    h('option', { value: '' }, 'All cities & regions'),
    ...cities.map((c) => h('option', { value: c }, c)),
  );

  const unesco = h('input', { type: 'checkbox', onchange: () => ((state.unescoOnly = unesco.checked), refresh(true)) });

  const catButtons = allCategories.map((cat) => {
    const meta = CATEGORY_META[cat];
    const btn = h(
      'button',
      {
        class: 'cat active',
        style: `--c:${meta.color}`,
        'aria-pressed': 'true',
        onclick: () => {
          if (state.categories.has(cat)) state.categories.delete(cat);
          else state.categories.add(cat);
          const on = state.categories.has(cat);
          btn.classList.toggle('active', on);
          btn.setAttribute('aria-pressed', String(on));
          refresh(false);
        },
      },
      `${meta.icon} ${meta.label} `,
      h('span', { class: 'count' }, String(counts.get(cat) ?? 0)),
    );
    return btn;
  });

  const onlyCaravan = h(
    'button',
    {
      class: 'btn small ghost',
      onclick: () => {
        state.categories = new Set(['caravanserai']);
        catButtons.forEach((b, i) => b.classList.toggle('active', allCategories[i] === 'caravanserai'));
        refresh(true);
        toast('Showing caravanserais — the roadside inns where Silk Road caravans rested.');
      },
    },
    '🐫 Only caravanserais',
  );
  const allBtn = h(
    'button',
    {
      class: 'btn small ghost',
      onclick: () => {
        state.categories = new Set(allCategories);
        catButtons.forEach((b) => b.classList.add('active'));
        refresh(false);
      },
    },
    'Show all',
  );

  const form = h(
    'form',
    {
      class: 'search',
      onsubmit: (e: Event) => {
        e.preventDefault();
        void searchPlaces();
      },
    },
    searchInput,
    h('button', { class: 'btn', type: 'submit', title: 'Search with Amazon Location Places' }, '🔎'),
  );

  let debounce: ReturnType<typeof setTimeout> | undefined;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.text = searchInput.value;
      refresh(false);
    }, 200);
  });

  panel.append(
    form,
    placeResults,
    h('div', { class: 'row' }, citySelect, h('label', { class: 'toggle' }, unesco, ' UNESCO only')),
    h('div', { class: 'cats' }, ...catButtons),
    h('div', { class: 'row' }, onlyCaravan, allBtn),
    resultInfo,
    list,
  );

  async function searchPlaces(): Promise<void> {
    const q = searchInput.value.trim();
    clear(placeResults);
    if (q.length < 2) return;
    placeResults.append(h('div', { class: 'muted small' }, 'Searching Amazon Location…'));
    try {
      const res = await ctx.api.search(q);
      clear(placeResults);
      if (res.results.length === 0) {
        placeResults.append(h('div', { class: 'muted small' }, 'No places found.'));
        return;
      }
      placeResults.append(h('div', { class: 'muted small' }, 'Places (Amazon Location):'), ...res.results.map(placeItem));
    } catch (err) {
      clear(placeResults);
      toast((err as Error).message, 'error');
    }
  }

  function placeItem(place: Place): HTMLElement {
    return h(
      'button',
      {
        class: 'place',
        onclick: () => {
          ctx.map.flyTo({ center: place.position, zoom: 13 });
          ctx.reachFrom(place.position, place.title);
        },
      },
      h('strong', {}, place.title),
      place.label ? h('span', { class: 'muted small' }, place.label) : null,
    );
  }

  function siteItem(site: SiteFeature): HTMLElement {
    const p = site.properties;
    const meta = CATEGORY_META[p.category];
    return h(
      'li',
      {},
      h(
        'button',
        {
          class: 'site',
          onclick: () => {
            ctx.map.flyTo({ center: site.geometry.coordinates, zoom: 15 });
            ctx.openSite(site);
          },
        },
        h('span', { class: 'dot', style: `background:${meta.color}` }),
        h('span', { class: 'site-name' }, p.name),
        p.unesco ? h('span', { class: 'gold', title: 'UNESCO World Heritage' }, '★') : null,
        h('span', { class: 'muted small' }, p.city),
      ),
    );
  }

  function refresh(zoom: boolean): void {
    const filtered = applyFilters(ctx.sites, state);
    setSites(ctx.map, filtered);
    resultInfo.textContent = `${filtered.length.toLocaleString()} sites match · top ${Math.min(LIST_LIMIT, filtered.length)} by significance`;
    clear(list);
    list.append(...topSites(filtered, LIST_LIMIT).map(siteItem));
    if (zoom && filtered.length > 0 && filtered.length < ctx.sites.length) fitTo(ctx.map, filtered.map((f) => f.geometry.coordinates));
  }

  refresh(false);

  // Allow other panels to reset the free-text filter.
  panel.addEventListener('explore:text', (e) => {
    searchInput.value = (e as CustomEvent<string>).detail;
    state.text = normalize(searchInput.value);
    refresh(true);
  });
}
