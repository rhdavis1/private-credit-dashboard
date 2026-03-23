// js/tabs/capital.js — Capital / NAV tab

import { fmtM, fmtRate, fmtDate, confidenceBadge } from '../formatters.js';

// ── NAV / financials history ──────────────────────────────────────────

function renderNavHistory(data) {
  const history = data.financials_history;
  if (!history || history.length === 0) {
    return '<div class="no-data">No NAV history available.</div>';
  }

  // Most recent first; columns: Period | Total Assets | Total Debt | Net Assets | Leverage
  const rows = [...history].reverse().map(h => {
    const leverage = (h.total_debt != null && h.total_assets)
      ? `${((h.total_debt / h.total_assets) * 100).toFixed(2)}%`
      : '—';
    return `
      <tr>
        <td>${h.period_end_date}</td>
        <td class="num">${fmtM(h.total_assets)}</td>
        <td class="num">${fmtM(h.total_debt)}</td>
        <td class="num"><strong>${fmtM(h.net_assets)}</strong></td>
        <td class="num">${leverage}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">NAV History</span>
        <span class="section-note">${history.length} periods &middot; amounts in $M</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th class="num">Total Assets ($M)</th>
              <th class="num">Total Debt ($M)</th>
              <th class="num">Net Assets / NAV ($M)</th>
              <th class="num">Leverage (Debt / TA)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Capital structure table ───────────────────────────────────────────

function renderCapStructure(data) {
  const cs = data.capital_structure;

  const rows = cs.items.map(item => `
    <tr>
      <td>${item.tranche_name}</td>
      <td class="num">${fmtM(item.amount)}</td>
      <td class="num">${fmtRate(item.interest_rate)}</td>
      <td>${fmtDate(item.maturity_date)}</td>
      <td class="muted" style="font-size:11px">${item.maturity_date_raw || '—'}</td>
    </tr>
  `).join('');

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Capital Structure</span>
        <span class="section-note">
          as of ${cs.as_of} &middot; ${cs.source_form} &middot; ${confidenceBadge(cs.confidence_band)}
        </span>
      </div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:8px">${cs.source_note}</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tranche</th>
              <th class="num">Amount ($M)</th>
              <th class="num">Rate</th>
              <th>Maturity</th>
              <th>Raw Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-2)">
        Total (N-CSR tranches): <strong>${fmtM(cs.total_debt)}</strong>
      </div>
    </div>
  `;
}

// ── Entry point ───────────────────────────────────────────────────────

const DEBT_NOTE = `
  <div style="font-size:11px;color:var(--text-3);padding:6px 0 4px;border-top:1px solid var(--border)">
    <strong>Note on debt figures:</strong>
    <em>Total Debt (NPORT-P)</em> above reflects only the borrowings schedule categories reported in the fund's
    NPORT-P filing. <em>Total Liabilities</em> is the broader balance-sheet figure from the same filing.
    Additional facility detail sourced from N-CSR filings appears in the Capital Structure table below.
  </div>
`;

export function renderCapital(container, data) {
  container.innerHTML = `
    <div>
      ${renderNavHistory(data)}
      ${DEBT_NOTE}
      ${renderCapStructure(data)}
    </div>
  `;
}
