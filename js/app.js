// js/app.js — bootstrap, state management, entity loading, hash routing

import { fmtM, periodBadge, domainBadge } from './formatters.js';
import { renderOverview } from './tabs/overview.js';
import { renderHoldings } from './tabs/holdings.js';
import { renderCapital  } from './tabs/capital.js';
import { renderFlows    } from './tabs/flows.js';
import { renderCompare  } from './tabs/compare.js';

const TAB_RENDERERS = {
  overview: renderOverview,
  holdings: renderHoldings,
  capital:  renderCapital,
  flows:    renderFlows,
  compare:  renderCompare,
};

const state = {
  manifest:     null,
  data:         null,
  activeEntity: null,   // cik string
  activeTab:    'overview',
};

// ── Routing helpers ──────────────────────────────────────────────────

function parseHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  return {
    entity: params.get('entity') || null,
    tab:    params.get('tab')    || 'overview',
  };
}

function pushHash(entity, tab) {
  history.pushState(null, '', `#entity=${entity}&tab=${tab}`);
  onHashChange();
}

// ── Data loading ─────────────────────────────────────────────────────

async function loadManifest() {
  const res = await fetch('manifest.json');
  if (!res.ok) throw new Error(`manifest.json not found (${res.status}). Run scripts/refresh_website_data.py first.`);
  return res.json();
}

async function loadSnapshot(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Snapshot not found: ${file} (${res.status})`);
  return res.json();
}

// ── Render: entity dropdown ──────────────────────────────────────────

function populateEntitySelect(activeEntity) {
  const sel = document.getElementById('entity-select');
  sel.innerHTML = '<option value="">— select entity —</option>';
  (state.manifest?.entities || []).forEach(e => {
    const opt = document.createElement('option');
    opt.value       = e.cik;
    opt.textContent = e.name;
    if (e.cik === activeEntity) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── Render: summary bar ──────────────────────────────────────────────

function renderSummaryBar(data) {
  const f  = data.financials;
  const hs = data.holdings_summary;

  // Compute leverage as total_debt / total_assets (not the pre-computed ratio field).
  // Shows '—' when total_debt is null (e.g. NPORT-P debt fields absent in filing).
  const leverageText = (f.total_debt != null && f.total_assets)
    ? `${((f.total_debt / f.total_assets) * 100).toFixed(2)}%`
    : '—';
  const leverageSub = f.total_debt != null ? 'debt / total assets' : 'not reported';

  document.getElementById('summary-bar').innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Total Assets</div>
      <div class="summary-value">${fmtM(f.total_assets)}</div>
      <div class="summary-sub">as of ${f.as_of}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Liabilities</div>
      <div class="summary-value">${fmtM(f.total_liabilities)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Net Assets</div>
      <div class="summary-value">${fmtM(f.net_assets)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Leverage (Debt / TA)</div>
      <div class="summary-value">${leverageText}</div>
      <div class="summary-sub">${leverageSub}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Positions</div>
      <div class="summary-value">${hs.total_positions.toLocaleString()}</div>
      <div class="summary-sub">${fmtM(hs.total_value_usd)} total value</div>
    </div>
  `;
}

// ── Render: header meta (right side badges) ──────────────────────────

function renderHeaderMeta(data) {
  const ep = data.snapshot_period;
  const domains = ep.domains_available.map(d => domainBadge(d)).join(' ');
  document.getElementById('header-meta').innerHTML = `
    ${periodBadge('Q: ' + ep.period_end_date)}
    ${domains}
    <span class="badge badge-form">${data.entity.filing_forms}</span>
  `;
}

// ── Render: active tab ───────────────────────────────────────────────

function setActiveTabButton(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

function renderActiveTab() {
  const container = document.getElementById('tab-content');
  container.innerHTML = '';
  const fn = TAB_RENDERERS[state.activeTab];
  if (fn && state.data) fn(container, state.data);
}

// ── Entity load + full render ─────────────────────────────────────────

async function loadAndRenderEntity(cik) {
  const entity = state.manifest.entities.find(e => e.cik === cik);
  if (!entity) return;

  const content = document.getElementById('tab-content');
  content.innerHTML = '<div class="loading">Loading snapshot…</div>';
  document.getElementById('summary-bar').innerHTML  = '';
  document.getElementById('header-meta').innerHTML = '';

  try {
    const data = await loadSnapshot(entity.snapshot_file);
    state.data         = data;
    state.activeEntity = cik;
    renderSummaryBar(data);
    renderHeaderMeta(data);
    renderActiveTab();
  } catch (err) {
    content.innerHTML = `<div class="loading" style="color:var(--negative)">${err.message}</div>`;
  }
}

// ── Hash change handler ───────────────────────────────────────────────

function onHashChange() {
  const { entity, tab } = parseHash();
  state.activeTab = tab;
  setActiveTabButton(tab);
  populateEntitySelect(entity);

  if (entity && entity !== state.activeEntity) {
    loadAndRenderEntity(entity);
  } else if (entity && entity === state.activeEntity) {
    renderActiveTab();
  }
}

// ── Init ──────────────────────────────────────────────────────────────

async function init() {
  try {
    state.manifest = await loadManifest();
  } catch (err) {
    document.getElementById('tab-content').innerHTML =
      `<div class="loading" style="color:var(--negative)">${err.message}</div>`;
    return;
  }

  const { entity, tab } = parseHash();
  state.activeTab = tab;
  setActiveTabButton(tab);
  populateEntitySelect(entity);

  // Entity dropdown → navigate
  document.getElementById('entity-select').addEventListener('change', e => {
    const cik = e.target.value;
    if (cik) pushHash(cik, state.activeTab);
  });

  // Tab buttons → navigate
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newTab = btn.dataset.tab;
      if (state.activeEntity) {
        pushHash(state.activeEntity, newTab);
      } else {
        state.activeTab = newTab;
        setActiveTabButton(newTab);
      }
    });
  });

  // Browser back/forward
  window.addEventListener('popstate', onHashChange);

  // Initial load: use hash entity, or auto-select first
  const targetCik = entity || state.manifest.entities[0]?.cik;
  if (targetCik) {
    pushHash(targetCik, tab);
  } else {
    document.getElementById('tab-content').innerHTML =
      '<div class="loading">No entities found in manifest.</div>';
  }
}

init().catch(err => {
  document.getElementById('tab-content').innerHTML =
    `<div class="loading" style="color:var(--negative)">Init error: ${err.message}</div>`;
  console.error(err);
});
