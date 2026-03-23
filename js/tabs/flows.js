// js/tabs/flows.js — Flows / Payouts tab (sortable table + redemptions % NAV chart)

import { fmtCurrency } from '../formatters.js';

// Module-level sort state (reset on fresh render)
let _sortAsc = true;

// ── Redemptions % NAV chart ───────────────────────────────────────────

/**
 * Build chart data points from quarter-end flow rows joined to financials history.
 * Returns array of { period, label, qPct, aPct } where pct values may be null.
 */
function buildChartPoints(flows, history) {
  const navByPeriod = {};
  (history || []).forEach(h => { navByPeriod[h.period_end_date] = h.net_assets; });

  return flows
    .filter(r => r.is_quarter_end)
    .map(r => {
      const nav  = navByPeriod[r.period_end_date] ?? null;
      const qPct = (nav && nav > 0 && r.redemptions_3m  != null)
        ? (r.redemptions_3m  / nav) * 100 : null;
      const aPct = (nav && nav > 0 && r.redemptions_12m != null)
        ? (r.redemptions_12m / nav) * 100 : null;
      return { period: r.period_end_date, label: r.period_month, qPct, aPct };
    });
}

function renderRedemptionsChart(flows, history) {
  const points = buildChartPoints(flows, history);
  const hasData = points.some(p => p.qPct != null || p.aPct != null);
  if (points.length < 2 || !hasData) return '';

  // Chart dimensions
  const W = 760, H = 210;
  const PAD = { top: 16, right: 120, bottom: 52, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const allVals = points.flatMap(p => [p.qPct, p.aPct]).filter(v => v != null);
  const rawMax  = Math.max(...allVals);
  // Round up to a nice tick ceiling
  const maxY = rawMax < 5 ? 5 : rawMax < 10 ? 10 : rawMax < 20 ? 20 : Math.ceil(rawMax / 5) * 5;

  const n = points.length;
  const xOf = i => PAD.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const yOf = v => PAD.top + plotH - (v / maxY) * plotH;

  // Polylines — quarterly (solid blue) and annual (dashed amber)
  const qCoords = points.map((p, i) => p.qPct != null ? `${xOf(i)},${yOf(p.qPct)}` : null);
  const aCoords = points.map((p, i) => p.aPct != null ? `${xOf(i)},${yOf(p.aPct)}` : null);

  // Split into contiguous segments to handle leading nulls gracefully
  function toSegments(coords) {
    const segs = []; let cur = [];
    coords.forEach(c => {
      if (c) { cur.push(c); }
      else if (cur.length) { segs.push(cur); cur = []; }
    });
    if (cur.length) segs.push(cur);
    return segs;
  }

  const qLines = toSegments(qCoords).map(seg =>
    `<polyline points="${seg.join(' ')}" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linejoin="round"/>`
  ).join('');
  const aLines = toSegments(aCoords).map(seg =>
    `<polyline points="${seg.join(' ')}" fill="none" stroke="#d97706" stroke-width="1.8" stroke-linejoin="round" stroke-dasharray="5,3"/>`
  ).join('');

  // Dots for quarterly points
  const qDots = points.map((p, i) => p.qPct != null
    ? `<circle cx="${xOf(i)}" cy="${yOf(p.qPct)}" r="3" fill="#1d4ed8" opacity="0.8"/>`
    : '').join('');
  const aDots = points.map((p, i) => p.aPct != null
    ? `<circle cx="${xOf(i)}" cy="${yOf(p.aPct)}" r="3" fill="#d97706" opacity="0.8"/>`
    : '').join('');

  // Y axis gridlines + ticks
  const tickStep = maxY <= 5 ? 1 : maxY <= 10 ? 2 : maxY <= 20 ? 5 : 10;
  const yTicks = [];
  for (let t = 0; t <= maxY; t += tickStep) {
    const y = yOf(t);
    yTicks.push(`<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + plotW}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`);
    yTicks.push(`<text x="${PAD.left - 6}" y="${y + 4}" font-size="10" text-anchor="end" fill="#94a3b8">${t}%</text>`);
  }

  // X axis labels (quarter labels, rotated)
  const xLabels = points.map((p, i) => {
    const x = xOf(i);
    const y = PAD.top + plotH + 12;
    return `<text x="${x}" y="${y}" font-size="10" text-anchor="end" transform="rotate(-40,${x},${y})" fill="#94a3b8">${p.period}</text>`;
  }).join('');

  // Legend
  const lx = PAD.left + plotW + 8;
  const legend = `
    <line x1="${lx}" y1="${PAD.top + 10}" x2="${lx + 18}" y2="${PAD.top + 10}" stroke="#1d4ed8" stroke-width="2"/>
    <text x="${lx + 22}" y="${PAD.top + 14}" font-size="10" fill="#475569">3M (quarterly)</text>
    <line x1="${lx}" y1="${PAD.top + 26}" x2="${lx + 18}" y2="${PAD.top + 26}" stroke="#d97706" stroke-width="2" stroke-dasharray="5,3"/>
    <text x="${lx + 22}" y="${PAD.top + 30}" font-size="10" fill="#475569">12M (trailing)</text>
  `;

  // Axis borders
  const axes = `
    <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + plotH}" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="${PAD.left}" y1="${PAD.top + plotH}" x2="${PAD.left + plotW}" y2="${PAD.top + plotH}" stroke="#cbd5e1" stroke-width="1"/>
  `;

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Redemptions as % of NAV</span>
        <span class="section-note">quarterly (3M) and trailing annual (12M) · quarter-end periods</span>
      </div>
      <div class="chart-wrap">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
          ${yTicks.join('')}
          ${axes}
          ${qLines}
          ${aLines}
          ${qDots}
          ${aDots}
          ${xLabels}
          ${legend}
        </svg>
      </div>
    </div>
  `;
}

// ── Flows table ───────────────────────────────────────────────────────

function renderFlowsTable(flows, sortAsc) {
  const sorted = [...flows].sort((a, b) => {
    const cmp = a.period_month < b.period_month ? -1 : a.period_month > b.period_month ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const lastQEnd    = [...flows].filter(r => r.is_quarter_end).at(-1);
  const trailing12m = lastQEnd?.redemptions_12m ?? null;

  const arrow = sortAsc ? ' ↑' : ' ↓';

  const rows = sorted.map(r => {
    const rowCls     = r.is_quarter_end ? 'row-highlight' : '';
    const qMark      = r.is_quarter_end ? '●' : '';
    const amendBadge = r.is_amended ? '<span class="badge badge-amended">AMD</span>' : '';
    const netCls     = r.net_flow < 0 ? 'negative' : r.net_flow > 0 ? 'positive' : '';

    return `
      <tr class="${rowCls}">
        <td style="font-family:var(--mono);font-size:12px;white-space:nowrap">${r.period_month}</td>
        <td class="ctr" style="font-size:11px;color:var(--text-3)">${qMark}</td>
        <td class="ctr">${amendBadge}</td>
        <td class="num">${fmtCurrency(r.sales)}</td>
        <td class="num">${fmtCurrency(r.reinvestment)}</td>
        <td class="num">${fmtCurrency(r.redemptions)}</td>
        <td class="num ${netCls}" style="font-weight:600">${fmtCurrency(r.net_flow)}</td>
        <td class="num muted">${r.redemptions_3m  != null ? fmtCurrency(r.redemptions_3m)  : ''}</td>
        <td class="num muted">${r.redemptions_12m != null ? fmtCurrency(r.redemptions_12m) : ''}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Monthly Fund Flows</span>
        <span class="section-note">
          ${flows.length} months &middot;
          trailing 12M redemptions: ${fmtCurrency(trailing12m)} &middot;
          ● quarter-end &middot; AMD = amended filing
        </span>
      </div>
      <div class="table-wrap">
        <table class="data-table" id="flows-table">
          <thead>
            <tr>
              <th class="sortable" id="flows-sort-period" style="cursor:pointer;user-select:none">Period${arrow}</th>
              <th class="ctr" title="Quarter-end">Q</th>
              <th class="ctr">Amd</th>
              <th class="num">Sales</th>
              <th class="num">Reinvestment</th>
              <th class="num">Redemptions</th>
              <th class="num">Net Flow</th>
              <th class="num">3M Redemptions</th>
              <th class="num">12M Redemptions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Entry point ───────────────────────────────────────────────────────

export function renderFlows(container, data) {
  const flows   = data.fund_flows;
  const history = data.financials_history;

  if (!flows || flows.length === 0) {
    container.innerHTML = '<div class="no-data">No fund flows data available.</div>';
    return;
  }

  _sortAsc = true;   // reset to chronological on each entity load

  function redraw() {
    container.innerHTML =
      renderFlowsTable(flows, _sortAsc) +
      renderRedemptionsChart(flows, history);

    // Wire sort toggle on Period header
    document.getElementById('flows-sort-period')?.addEventListener('click', () => {
      _sortAsc = !_sortAsc;
      redraw();
    });
  }

  redraw();
}
