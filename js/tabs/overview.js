// js/tabs/overview.js — Overview tab renderer

import {
  fmtCurrency, fmtCurrencyFull, fmtM, fmtPct, fmtRate,
  confidenceBadge, categoryLabel,
} from '../formatters.js';

// ── Entity info block ────────────────────────────────────────────────

function renderEntityBlock(data) {
  const e  = data.entity;
  const ep = data.snapshot_period;
  const sm = data.source_metadata;
  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Entity</span>
      </div>
      <div class="kv-grid">
        <div class="kv-item">
          <div class="kv-label">Name</div>
          <div class="kv-value text">${e.name}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">CIK</div>
          <div class="kv-value">${e.cik}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Type</div>
          <div class="kv-value text">${e.entity_type}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Filing Form</div>
          <div class="kv-value text">${e.filing_forms}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Snapshot Period</div>
          <div class="kv-value">${ep.period_end_date}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Filings in Window</div>
          <div class="kv-value">${sm.canonical_filings} / ${sm.filings_in_window}</div>
          <div class="kv-sub">canonical / total</div>
        </div>
      </div>
    </div>
  `;
}

// ── Financials block ─────────────────────────────────────────────────

function renderFinancialsBlock(data) {
  const f = data.financials;
  // Compute leverage as debt / total assets; suppress when debt unknown.
  const leverage = (f.total_debt != null && f.total_assets)
    ? (f.total_debt / f.total_assets) * 100
    : null;
  const leverageText  = leverage != null ? `${leverage.toFixed(2)}%` : '—';
  const leverageClass = leverage != null && leverage > 30 ? 'negative' : '';

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Financials</span>
        <span class="section-note">
          as of ${f.as_of} &middot; ${f.source_form} &middot; ${confidenceBadge(f.confidence_band)}
        </span>
      </div>
      <div class="kv-grid">
        <div class="kv-item">
          <div class="kv-label">Total Assets</div>
          <div class="kv-value">${fmtM(f.total_assets)}</div>
          <div class="kv-sub">${fmtCurrencyFull(f.total_assets)}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Total Liabilities</div>
          <div class="kv-value">${fmtM(f.total_liabilities)}</div>
          <div class="kv-sub">all balance sheet liabilities</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Net Assets (NAV)</div>
          <div class="kv-value">${fmtM(f.net_assets)}</div>
          <div class="kv-sub">${fmtCurrencyFull(f.net_assets)}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Total Debt (NPORT-P)</div>
          <div class="kv-value">${fmtM(f.total_debt)}</div>
          <div class="kv-sub">borrowings schedule fields</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Leverage (Debt / TA)</div>
          <div class="kv-value ${leverageClass}">${leverageText}</div>
          <div class="kv-sub">debt / total assets</div>
        </div>
      </div>
    </div>
  `;
}

// ── Fund flows summary ────────────────────────────────────────────────

function renderFlowsSummary(data) {
  const flows = data.fund_flows;
  if (!flows || flows.length === 0) return '';

  const lastQEnd = [...flows].reverse().find(r => r.is_quarter_end);
  const trailing12m = lastQEnd?.redemptions_12m ?? null;

  const windowSales  = flows.reduce((s, r) => s + (r.sales       || 0), 0);
  const windowRedeem = flows.reduce((s, r) => s + (r.redemptions || 0), 0);
  const windowNet    = flows.reduce((s, r) => s + (r.net_flow    || 0), 0);
  const netClass     = windowNet < 0 ? 'negative' : windowNet > 0 ? 'positive' : '';

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Fund Flows</span>
        <span class="section-note">${flows.length} months in window</span>
      </div>
      <div class="kv-grid">
        <div class="kv-item">
          <div class="kv-label">Total Sales</div>
          <div class="kv-value">${fmtCurrency(windowSales)}</div>
          <div class="kv-sub">over ${flows.length}-month window</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Total Redemptions</div>
          <div class="kv-value">${fmtCurrency(windowRedeem)}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Net Flow</div>
          <div class="kv-value ${netClass}">${fmtCurrency(windowNet)}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Trailing 12M Redemptions</div>
          <div class="kv-value">${fmtCurrency(trailing12m)}</div>
          <div class="kv-sub">${lastQEnd ? 'as of ' + lastQEnd.period_end_date : ''}</div>
        </div>
      </div>
    </div>
  `;
}

// ── Holdings summary by category ──────────────────────────────────────

function renderHoldingsSummary(data) {
  const hs  = data.holdings_summary;
  const cats = [...hs.by_asset_category]
    .filter(c => c.value_usd > 0)
    .sort((a, b) => b.value_usd - a.value_usd)
    .slice(0, 10);

  const total   = hs.total_value_usd || 1;
  const maxVal  = cats[0]?.value_usd || 1;

  const rows = cats.map(c => {
    const pct    = (c.value_usd / total) * 100;
    const barPct = Math.max(0, Math.min(100, (c.value_usd / maxVal) * 100));
    const label  = categoryLabel(c.category);
    const title  = c.category ? ` title="${c.category}"` : '';
    return `
      <tr>
        <td${title}>${label}</td>
        <td class="num">${c.count.toLocaleString()}</td>
        <td class="num">${fmtCurrency(c.value_usd)}</td>
        <td class="num">
          <div class="bar-cell">
            <span>${pct.toFixed(1)}%</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${barPct.toFixed(1)}%"></div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const flagLine = (hs.positions_in_default > 0 || hs.positions_pik > 0)
    ? `<div style="margin-top:7px;font-size:11px;color:var(--text-3)">
         ${hs.positions_in_default} in default &middot;
         ${hs.positions_pik} PIK &middot;
         ${hs.positions_needs_review} needs review
       </div>`
    : '';

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Holdings by Category</span>
        <span class="section-note">
          ${hs.total_positions.toLocaleString()} positions &middot; as of ${hs.as_of}
        </span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th class="num">Count</th>
              <th class="num">Value (USD)</th>
              <th class="num">% of Portfolio</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${flagLine}
    </div>
  `;
}

// ── Capital structure brief ───────────────────────────────────────────

function renderCapBrief(data) {
  const cs = data.capital_structure;
  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Capital Structure</span>
        <span class="section-note">${confidenceBadge(cs.confidence_band)}</span>
      </div>
      <div class="quality-panel">
        <div class="quality-row">
          <span class="quality-key">As of</span>
          <span class="quality-val">${cs.as_of}</span>
        </div>
        <div class="quality-row">
          <span class="quality-key">Source Form</span>
          <span class="quality-val">${cs.source_form}</span>
        </div>
        <div class="quality-row">
          <span class="quality-key">Total Debt (N-CSR)</span>
          <span class="quality-val">${fmtCurrency(cs.total_debt)}</span>
        </div>
        <div class="quality-row">
          <span class="quality-key">Tranches</span>
          <span class="quality-val">${cs.items.length}</span>
        </div>
        <div class="quality-row">
          <span class="quality-key">Source Note</span>
          <span class="quality-val text" style="font-size:11px;color:var(--text-3)">${cs.source_note}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Data quality panel ────────────────────────────────────────────────

function renderDataQuality(data) {
  const dq = data.data_quality;
  const sm = data.source_metadata;

  const warningHtml = dq.warnings.length > 0
    ? `<ul class="warnings-list">${dq.warnings.map(w =>
        `<li class="warning-item">${w}</li>`).join('')}</ul>`
    : '';

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Data Quality</span>
      </div>
      <div class="quality-panel">
        <div class="quality-row">
          <span class="quality-key">Cap Structure Confidence</span>
          <span class="quality-val">${confidenceBadge(dq.cap_structure_confidence)}</span>
        </div>
        <div class="quality-row">
          <span class="quality-key">Holdings Needing Review</span>
          <span class="quality-val">${dq.holdings_needs_review_count}</span>
        </div>
        <div class="quality-row">
          <span class="quality-key">Periods with Metrics</span>
          <span class="quality-val">${sm.periods_with_metrics}</span>
        </div>
        <div class="quality-row">
          <span class="quality-key">Periods with Holdings</span>
          <span class="quality-val">${sm.periods_with_holdings}</span>
        </div>
        <div class="quality-row">
          <span class="quality-key">Periods with Cap Structure</span>
          <span class="quality-val">${sm.periods_with_capital_structure}</span>
        </div>
        <div class="quality-row">
          <span class="quality-key">Ingest Run ID</span>
          <span class="quality-val">${sm.ingest_run_id}</span>
        </div>
      </div>
      ${warningHtml}
    </div>
  `;
}

// ── Entry point ───────────────────────────────────────────────────────

export function renderOverview(container, data) {
  container.innerHTML = `
    <div class="two-col">
      <div>
        ${renderEntityBlock(data)}
        ${renderFinancialsBlock(data)}
        ${renderFlowsSummary(data)}
      </div>
      <div>
        ${renderHoldingsSummary(data)}
        ${renderCapBrief(data)}
        ${renderDataQuality(data)}
      </div>
    </div>
  `;
}
