// js/tabs/holdings.js — Holdings tab: filterable + paginated table

import { fmtCurrency, fmtRate, categoryLabel } from '../formatters.js';

const PAGE_SIZE = 50;

// Module-level state reset on each fresh render
let _state = { search: '', category: '', page: 0 };

function getCategories(holdings) {
  const seen = new Set();
  holdings.forEach(h => { if (h.asset_category) seen.add(h.asset_category); });
  return Array.from(seen).sort();
}

function filterHoldings(holdings, search, category) {
  return holdings.filter(h => {
    if (category && h.asset_category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return (h.issuer_name || '').toLowerCase().includes(q)
          || (h.issue_title  || '').toLowerCase().includes(q);
    }
    return true;
  });
}

function buildFlagsCell(h) {
  const parts = [];
  if (h.in_default       === true) parts.push('<span class="flag flag-d" title="In default">D</span>');
  if (h.paid_in_kind     === true) parts.push('<span class="flag flag-p" title="Paid-in-kind">P</span>');
  if (h.interest_in_arrears === true) parts.push('<span class="flag flag-a" title="Interest in arrears">A</span>');
  return parts.join(' ');
}

function renderTable(filtered, page) {
  const start = page * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  if (slice.length === 0) {
    return '<div class="no-data">No matching positions.</div>';
  }

  const rows = slice.map((h, i) => {
    const rank      = start + i + 1;
    const pct       = h.pct_of_net_assets;
    // Scale bar: 5% NAV fills the bar completely (5% = 100%)
    const barPct    = pct != null ? Math.max(0, Math.min(100, pct * 20)) : 0;
    const flags     = buildFlagsCell(h);
    const sectorTxt = h.sector        != null ? h.sector                        : '—';
    const riskTxt   = h.ai_risk_score != null ? h.ai_risk_score.toFixed(1)      : '—';
    const riskCls   = h.ai_risk_score != null ? 'num'                           : 'num muted';

    return `
      <tr>
        <td class="num muted" style="width:44px">${rank}</td>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            title="${(h.issuer_name || '').replace(/"/g, '&quot;')}">${h.issuer_name || '—'}</td>
        <td title="${h.asset_category || ''}">${categoryLabel(h.asset_category)}</td>
        <td class="muted" style="font-size:11px;white-space:nowrap">${sectorTxt}</td>
        <td class="num">${fmtCurrency(h.value_usd)}</td>
        <td class="num">
          <div class="bar-cell">
            <span>${pct != null ? pct.toFixed(2) + '%' : '—'}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${barPct.toFixed(1)}%"></div>
            </div>
          </div>
        </td>
        <td class="num">${fmtRate(h.annualized_rate)}</td>
        <td class="muted" style="font-size:11px;white-space:nowrap">${h.interest_rate_type || '—'}</td>
        <td class="${riskCls}">${riskTxt}</td>
        <td style="white-space:nowrap">${flags}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Issuer</th>
            <th>Category</th>
            <th>Sector</th>
            <th class="num">Value (USD)</th>
            <th class="num">% NAV</th>
            <th class="num">Rate</th>
            <th>Rate Type</th>
            <th class="num">Risk Score</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderPagination(filtered, page) {
  const total = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return '';

  const start = page * PAGE_SIZE + 1;
  const end   = Math.min((page + 1) * PAGE_SIZE, total);

  // Show a sliding window of page buttons
  const lo = Math.max(0, page - 2);
  const hi = Math.min(totalPages - 1, page + 2);
  const pageBtns = [];
  for (let i = lo; i <= hi; i++) {
    pageBtns.push(`<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i + 1}</button>`);
  }

  return `
    <div class="pagination">
      <span class="page-info">${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}</span>
      <button class="page-btn" data-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>‹</button>
      ${pageBtns.join('')}
      <button class="page-btn" data-page="${page + 1}" ${page >= totalPages - 1 ? 'disabled' : ''}>›</button>
    </div>
  `;
}

function rerender(container, data) {
  const { search, category, page } = _state;
  const filtered = filterHoldings(data.holdings, search, category);

  const tableDiv = container.querySelector('#holdings-table');
  if (tableDiv) {
    tableDiv.innerHTML = renderTable(filtered, page) + renderPagination(filtered, page);
    // Bind pagination clicks after injecting HTML
    tableDiv.querySelectorAll('.page-btn[data-page]').forEach(btn => {
      const p = parseInt(btn.dataset.page, 10);
      if (isNaN(p) || btn.disabled) return;
      btn.addEventListener('click', () => {
        _state.page = p;
        rerender(container, data);
        tableDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  const countEl = container.querySelector('#holdings-count');
  if (countEl) {
    countEl.textContent = `${filtered.length.toLocaleString()} of ${data.holdings.length.toLocaleString()} positions`;
  }
}

export function renderHoldings(container, data) {
  _state = { search: '', category: '', page: 0 };

  const categories  = getCategories(data.holdings);
  const catOptions  = categories.map(c => `<option value="${c}">${categoryLabel(c)}</option>`).join('');

  container.innerHTML = `
    <div class="controls-bar">
      <input  type="search" id="holdings-search" class="search-input"
              placeholder="Search issuer name…" autocomplete="off">
      <select id="holdings-cat" class="filter-select">
        <option value="">All categories</option>
        ${catOptions}
      </select>
      <span class="controls-right" id="holdings-count"></span>
    </div>
    <div id="holdings-table"></div>
  `;

  rerender(container, data);

  container.querySelector('#holdings-search').addEventListener('input', e => {
    _state.search = e.target.value.trim();
    _state.page   = 0;
    rerender(container, data);
  });

  container.querySelector('#holdings-cat').addEventListener('change', e => {
    _state.category = e.target.value;
    _state.page     = 0;
    rerender(container, data);
  });
}
