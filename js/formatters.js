// js/formatters.js — number, date, badge, and category formatting utilities

// ── Asset category lookup ─────────────────────────────────────────────
// Maps NPORT-P asset_cat codes to human-readable display labels.
// Raw code is preserved for tooltips / filter values.

export const ASSET_CATEGORY_LABELS = {
  'LON':      'Corporate Loans',
  'EC':       'Equity – Common',
  'EP':       'Equity – Preferred',
  'DIR':      'Direct Lending',
  'DBT':      'Corporate Bonds',
  'DE':       'Derivatives',
  'DFE':      'Derivatives – Futures / FX',
  'ABS-MBS':  'ABS – Mortgage-Backed',
  'ABS-CBDO': 'ABS – CLO / CDO',
  'ABS-O':    'ABS – Other',
  'STIV':     'Short-Term Investments',
};

/**
 * Return a friendly display label for a raw asset_category code.
 * Falls back to the raw code itself if not in the lookup (future-proofing).
 * Null / undefined → 'Uncategorized'.
 */
export function categoryLabel(code) {
  if (!code) return 'Uncategorized';
  return ASSET_CATEGORY_LABELS[code] ?? code;
}

// ── Currency formatters ───────────────────────────────────────────────

/**
 * Compact format: auto-scales to B / M / K.
 *   56_338_645_518 → "$56.34B"
 *   350_595_785    → "$350.60M"
 * Handles null and negatives.
 */
export function fmtCurrency(val, decimals = 2) {
  if (val == null) return '—';
  const abs  = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(decimals)}K`;
  return `${sign}$${abs.toFixed(decimals)}`;
}

/**
 * Always-millions format: forces display in $M regardless of magnitude.
 * Large values get 0 decimals; sub-billion values get 1 decimal.
 *   56_338_645_518 → "$56,339M"
 *   350_595_785    → "$350.6M"
 */
export function fmtM(val) {
  if (val == null) return '—';
  const abs  = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  const dec  = abs >= 1e9 ? 0 : 1;
  const num  = (abs / 1e6).toFixed(dec);
  // Add thousands separator for large M values
  const formatted = parseFloat(num).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  return `${sign}$${formatted}M`;
}

/** Full integer dollar format: $1,247,158,729 */
export function fmtCurrencyFull(val) {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(val);
}

// ── Percentage formatters ─────────────────────────────────────────────

/** Format a ratio (0–1) as a percentage: 0.1783 → "17.83%" */
export function fmtPct(ratio, decimals = 2) {
  if (ratio == null) return '—';
  return `${(ratio * 100).toFixed(decimals)}%`;
}

/** Format a raw percent value: 8.5 → "8.50%" */
export function fmtRate(val) {
  if (val == null) return '—';
  return `${Number(val).toFixed(2)}%`;
}

// ── Date formatter ────────────────────────────────────────────────────

/** Pass-through for YYYY-MM-DD strings; null → '—'. */
export function fmtDate(val) {
  return val || '—';
}

// ── Badge helpers ─────────────────────────────────────────────────────

/** Render a confidence badge span (high / medium / low). */
export function confidenceBadge(val) {
  if (!val) return '';
  return `<span class="badge badge-${val}">${val}</span>`;
}

/** Render a period badge span. */
export function periodBadge(text) {
  return `<span class="badge badge-period">${text}</span>`;
}

/** Render a domain badge span. */
export function domainBadge(domain) {
  return `<span class="badge badge-domain">${domain}</span>`;
}
