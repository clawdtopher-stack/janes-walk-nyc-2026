const els = {
  search: document.getElementById('search'),
  searchClear: document.getElementById('searchClear'),
  datePills: document.getElementById('datePills'),
  timePills: document.getElementById('timePills'),
  boroughPills: document.getElementById('boroughPills'),
  neighborhoodPills: document.getElementById('neighborhoodPills'),
  walkTypePills: document.getElementById('walkTypePills'),
  sort: document.getElementById('sort'),
  stats: document.getElementById('stats'),
  activeFilters: document.getElementById('activeFilters'),
  grid: document.getElementById('grid'),
  emptyState: document.getElementById('emptyState'),
  clearAll: document.getElementById('clearAll'),
  emptyClear: document.getElementById('emptyClear'),
  filterToggle: document.getElementById('filterToggle'),
  filterClose: document.getElementById('filterClose'),
  filterPanel: document.getElementById('filterPanel'),
  filterBackdrop: document.getElementById('filterBackdrop'),
  filterBadge: document.getElementById('filterBadge'),
  applyFilters: document.getElementById('applyFilters'),
  jumpToFilters: document.getElementById('jumpToFilters'),
  heroStatTotal: document.getElementById('heroStatTotal'),
  filtersAnchor: document.getElementById('filtersAnchor'),
};

const state = {
  events: [],
  filtered: [],
  filters: {
    search: '',
    date: [],
    time: [],
    borough: [],
    neighborhood: [],
    walkType: [],
    sort: 'date',
  },
  options: {
    date: [],
    time: [],
    borough: [],
    neighborhood: [],
    walkType: [],
  }
};

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDateText(dateText = '') {
  if (/virtual\s*\/\s*on-demand/i.test(dateText)) {
    return { dayName: '', day: '', time: '', dateLabel: 'Virtual / on-demand', sortKey: 999999 };
  }
  const m = dateText.match(/(Friday|Saturday|Sunday)\s+May\s+(\d+)\s*\|\s*(.+)/i);
  if (!m) return { dayName: '', day: '', time: '', dateLabel: 'Unknown', sortKey: Number.MAX_SAFE_INTEGER };
  const dayName = m[1];
  const day = Number(m[2]);
  if (![1, 2, 3].includes(day)) return { dayName: '', day: '', time: '', dateLabel: 'Unknown', sortKey: Number.MAX_SAFE_INTEGER };
  const time = m[3].trim();
  const minutes = toMinutes(time);
  return {
    dayName,
    day,
    time,
    dateLabel: `May ${day} (${dayName})`,
    sortKey: day * 1440 + (minutes ?? 0),
  };
}

function toMinutes(time = '') {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const meridiem = m[3].toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function timeBucket(time = '') {
  const minutes = toMinutes(time);
  if (minutes == null) return 'Unknown';
  if (minutes < 600) return 'Morning (before 10)';
  if (minutes < 720) return 'Late Morning (10–12)';
  if (minutes < 900) return 'Afternoon (12–3)';
  if (minutes < 1080) return 'Late Afternoon (3–6)';
  return 'Evening (6+)';
}

function durationMinutes(duration = '') {
  const normalized = duration.toLowerCase();
  const mins = normalized.match(/(\d+)\s*minutes?/);
  if (mins) return Number(mins[1]);
  const hours = normalized.match(/(\d+(?:\.\d+)?)\s*hours?/);
  if (hours) return Math.round(Number(hours[1]) * 60);
  return Number.MAX_SAFE_INTEGER;
}

function sortEvents(events) {
  const list = [...events];
  switch (state.filters.sort) {
    case 'title':
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'borough':
      list.sort((a, b) => `${a.borough || ''} ${a.title || ''}`.localeCompare(`${b.borough || ''} ${b.title || ''}`));
      break;
    case 'duration':
      list.sort((a, b) => durationMinutes(a.duration || '') - durationMinutes(b.duration || '') || (a.title || '').localeCompare(b.title || ''));
      break;
    case 'date':
    default:
      list.sort((a, b) => parseDateText(a.dateText || '').sortKey - parseDateText(b.dateText || '').sortKey || (a.title || '').localeCompare(b.title || ''));
      break;
  }
  return list;
}

function optionFill(select, items, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` + items.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
}

function activeFilterEntries() {
  const out = [];
  if (state.filters.search) out.push(['search', state.filters.search, `Search: ${state.filters.search}`]);
  for (const key of ['date', 'time', 'borough', 'neighborhood', 'walkType']) {
    for (const value of state.filters[key]) out.push([key, value, value]);
  }
  return out;
}

function updateFilterBadge() {
  const count = activeFilterEntries().length;
  els.filterBadge.hidden = count === 0;
  els.filterBadge.textContent = count;
}

function renderActiveFilters() {
  const filters = activeFilterEntries();
  els.activeFilters.innerHTML = filters.map(([key, value, label]) => (
    `<button class="active-filter" type="button" data-clear="${escapeHtml(key)}">${escapeHtml(label)} <span aria-hidden="true">×</span></button>`
  )).join('');
}

function maybeDescription(desc = '') {
  return desc.length > 220;
}

function walkTypeLabel(value = '') {
  const map = {
    'guided-group': 'Guided group',
    'self-guided': 'Self-guided',
    'virtual': 'Virtual',
  };
  return map[value] || value;
}

function cardHtml(ev, index) {
  const desc = ev.description || '';
  const descId = `desc-${index}`;
  return `
    <article class="card">
      <div class="card-date">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M5 2.5v2M11 2.5v2M2.5 6.5h11"/></svg>
        <span>${escapeHtml(ev.dateText || 'Date TBD')}</span>
      </div>
      <h2 class="card-title">${escapeHtml(ev.title || 'Untitled walk')}</h2>
      <div class="card-meta">
        ${ev.borough ? `<span class="chip chip--borough">${escapeHtml(ev.borough)}</span>` : ''}
        ${ev.neighborhood ? `<span class="chip">${escapeHtml(ev.neighborhood)}</span>` : ''}
        ${ev.duration ? `<span class="chip chip--duration">${escapeHtml(ev.duration)}</span>` : ''}
        ${ev.walkType ? `<span class="chip chip--type">${escapeHtml(walkTypeLabel(ev.walkType))}</span>` : ''}
      </div>
      ${ev.address ? `<div class="card-address"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 14s4-3.8 4-7A4 4 0 1 0 4 7c0 3.2 4 7 4 7Z"/><circle cx="8" cy="7" r="1.5"/></svg><span>${escapeHtml(ev.address)}</span></div>` : ''}
      <p class="card-desc" id="${descId}">${escapeHtml(desc)}</p>
      <div class="card-footer">
        ${maybeDescription(desc) ? `<button class="card-expand" type="button" data-expand="${descId}">Read more</button>` : `<span></span>`}
        <a class="btn-book" href="${escapeHtml(ev.bookingUrl || ev.url || '#')}" target="_blank" rel="noopener">Book / View</a>
      </div>
    </article>
  `;
}

function renderGrid() {
  els.grid.innerHTML = state.filtered.map((ev, index) => cardHtml(ev, index)).join('');
  els.emptyState.hidden = state.filtered.length !== 0;
}

function renderStats() {
  const total = state.events.length;
  const shown = state.filtered.length;
  const filterCount = activeFilterEntries().length;
  els.stats.textContent = filterCount
    ? `${shown} of ${total} walks shown · ${filterCount} active filter${filterCount === 1 ? '' : 's'}`
    : `${total} walks across May 1–3, 2026`;
}

function readFiltersFromUI() {
  state.filters.search = els.search.value.trim();
  state.filters.sort = els.sort.value || 'date';
}

function applyFilters() {
  readFiltersFromUI();
  const q = state.filters.search.toLowerCase();
  const filtered = state.events.filter(ev => {
    const parsed = parseDateText(ev.dateText || '');
    const bucket = timeBucket(parsed.time || '');
    const haystack = [ev.title, ev.description, ev.neighborhood, ev.borough, ev.address].filter(Boolean).join(' ').toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (state.filters.date.length && !state.filters.date.includes(parsed.dateLabel)) return false;
    if (state.filters.time.length && !state.filters.time.includes(bucket)) return false;
    if (state.filters.borough.length && !state.filters.borough.includes(ev.borough)) return false;
    if (state.filters.neighborhood.length && !state.filters.neighborhood.includes(ev.neighborhood)) return false;
    if (state.filters.walkType.length && !state.filters.walkType.includes(walkTypeLabel(ev.walkType))) return false;
    return true;
  });
  state.filtered = sortEvents(filtered);
  renderStats();
  renderActiveFilters();
  updateFilterBadge();
  renderGrid();
}

function clearAll() {
  els.search.value = '';
  state.filters.date = [];
  state.filters.time = [];
  state.filters.borough = [];
  state.filters.neighborhood = [];
  state.filters.walkType = [];
  els.sort.value = 'date';
  els.searchClear.hidden = true;
  renderPills();
  applyFilters();
}

function openFilters() {
  els.filterPanel.classList.add('open');
  els.filterBackdrop.hidden = false;
  els.filterToggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function closeFilters() {
  els.filterPanel.classList.remove('open');
  els.filterBackdrop.hidden = true;
  els.filterToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

function bindEvents() {
  [els.search, els.sort].forEach(el => {
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      if (el === els.search) els.searchClear.hidden = !els.search.value.trim();
      applyFilters();
      updateFilterBadge();
    });
  });

  els.searchClear.addEventListener('click', () => {
    els.search.value = '';
    els.searchClear.hidden = true;
    applyFilters();
  });

  els.clearAll.addEventListener('click', clearAll);
  els.emptyClear.addEventListener('click', clearAll);
  els.applyFilters.addEventListener('click', () => {
    applyFilters();
    closeFilters();
  });

  els.filterToggle.addEventListener('click', openFilters);
  els.jumpToFilters?.addEventListener('click', () => {
    els.filtersAnchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  els.filterClose.addEventListener('click', closeFilters);
  els.filterBackdrop.addEventListener('click', closeFilters);

  document.addEventListener('click', event => {
    const clearKey = event.target.closest('[data-clear]')?.dataset.clear;
    if (clearKey) {
      if (clearKey === 'search') {
        els.search.value = '';
        els.searchClear.hidden = true;
      } else if (Array.isArray(state.filters[clearKey])) {
        state.filters[clearKey] = state.filters[clearKey].filter(v => v !== event.target.closest('[data-clear]')?.dataset.value);
        renderPills();
      }
      applyFilters();
      return;
    }

    const pill = event.target.closest('[data-pill-group]');
    if (pill) {
      const key = pill.dataset.pillGroup;
      const value = pill.dataset.value;
      const arr = state.filters[key];
      if (arr.includes(value)) {
        state.filters[key] = arr.filter(v => v !== value);
      } else {
        state.filters[key] = [...arr, value];
      }
      renderPills();
      applyFilters();
      return;
    }

    const expandId = event.target.closest('[data-expand]')?.dataset.expand;
    if (expandId) {
      const desc = document.getElementById(expandId);
      if (!desc) return;
      const expanded = desc.classList.toggle('expanded');
      event.target.textContent = expanded ? 'Show less' : 'Read more';
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeFilters();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeFilters();
  });
}

function cleanNeighborhood(value) {
  if (!value) return null;
  return String(value).trim() || null;
}

function isUsableNeighborhood(value) {
  return Boolean(cleanNeighborhood(value));
}

function normalizedEvent(ev) {
  return {
    ...ev,
    neighborhood: cleanNeighborhood(ev.neighborhood),
  };
}

function renderPillGroup(container, key, items) {
  container.innerHTML = items.map(item => {
    const active = state.filters[key].includes(item);
    return `<button type="button" class="filter-pill${active ? ' is-active' : ''}" data-pill-group="${key}" data-value="${escapeHtml(item)}" aria-pressed="${active}">${escapeHtml(item)}</button>`;
  }).join('');
}

function renderPills() {
  renderPillGroup(els.datePills, 'date', state.options.date);
  renderPillGroup(els.timePills, 'time', state.options.time);
  renderPillGroup(els.boroughPills, 'borough', state.options.borough);
  renderPillGroup(els.neighborhoodPills, 'neighborhood', state.options.neighborhood);
  renderPillGroup(els.walkTypePills, 'walkType', state.options.walkType);
}

function populateFilters(events) {
  const parsedDates = events.map(ev => parseDateText(ev.dateText || ''));
  state.options.date = uniq(parsedDates.map(d => d.dateLabel).filter(v => v !== 'Unknown'));
  state.options.time = ['Morning (before 10)', 'Late Morning (10–12)', 'Afternoon (12–3)', 'Late Afternoon (3–6)', 'Evening (6+)'].filter(bucket => events.some(ev => timeBucket(parseDateText(ev.dateText || '').time) === bucket));
  state.options.borough = uniq(events.map(ev => ev.borough));
  state.options.neighborhood = uniq(events.map(ev => ev.neighborhood).filter(isUsableNeighborhood));
  state.options.walkType = uniq(events.map(ev => ev.walkType).map(walkTypeLabel));
  renderPills();
  els.sort.value = 'date';
}

function renderLoading() {
  els.grid.innerHTML = `<div class="skeleton-grid">${Array.from({ length: 6 }, () => '<div class="skeleton-card"></div>').join('')}</div>`;
}

async function init() {
  renderLoading();
  bindEvents();
  const response = await fetch('./data/events-merged.json');
  state.events = (await response.json()).map(normalizedEvent);
  if (els.heroStatTotal) els.heroStatTotal.textContent = String(state.events.length);
  populateFilters(state.events);
  applyFilters();
}

init().catch(err => {
  console.error(err);
  els.stats.textContent = 'Failed to load Jane\'s Walk data';
  els.grid.innerHTML = '<div class="empty-state"><h3 class="empty-title">Could not load the app data</h3><p class="empty-sub">Try refreshing the page.</p></div>';
});
