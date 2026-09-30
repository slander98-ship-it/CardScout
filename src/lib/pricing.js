// Pricing math: fees, deal indicator, and robust stats over noisy comps.

export const money = (n, digits = 0) =>
  n === '' || n == null || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

export const money2 = (n) => money(n, 2);
export const num = (v) => (v === '' || v == null ? null : Number(v));

/** What you'd actually pocket selling at `salePrice` after fees and shipping. */
export function netAfterFees(salePrice, s) {
  if (!salePrice) return 0;
  const fee = salePrice * (Number(s.feePercent) / 100) + Number(s.feeFixed);
  return salePrice - fee - Number(s.shippingCost);
}

/**
 * Deal verdict for buying at `asking` when the card is worth `market`.
 * Returns { tier: 'great'|'fair'|'over', label, pctOfMarket, flipProfit, flipMargin, net }.
 */
export function evaluateDeal(asking, market, s) {
  asking = Number(asking);
  market = Number(market);
  if (!asking || !market) return null;
  const pctOfMarket = (asking / market) * 100;
  const net = netAfterFees(market, s);
  const flipProfit = net - asking;
  const flipMargin = (flipProfit / asking) * 100;
  let tier = 'over';
  if (pctOfMarket <= s.greatBuyMaxPct) tier = 'great';
  else if (pctOfMarket <= s.fairMaxPct) tier = 'fair';
  const label = { great: 'Great Buy', fair: 'Fair', over: 'Overpriced' }[tier];
  // Walk-away price that still leaves a 20% flip margin.
  const targetBuy = net / 1.2;
  return { tier, label, pctOfMarket, flipProfit, flipMargin, net, targetBuy };
}

/** Low/avg/median/high after trimming outliers with the IQR rule. */
export function robustStats(prices) {
  const xs = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (!xs.length) return null;
  const q = (p) => {
    const i = (xs.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
  };
  let kept = xs;
  if (xs.length >= 5) {
    const q1 = q(0.25);
    const q3 = q(0.75);
    const iqr = q3 - q1;
    kept = xs.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
  }
  const avg = kept.reduce((a, b) => a + b, 0) / kept.length;
  const mid = Math.floor(kept.length / 2);
  const median = kept.length % 2 ? kept[mid] : (kept[mid - 1] + kept[mid]) / 2;
  return { low: kept[0], high: kept[kept.length - 1], avg, median, count: kept.length, dropped: xs.length - kept.length };
}

export const TIER_STYLES = {
  great: { bg: 'bg-emerald-500', text: 'text-emerald-300', ring: 'ring-emerald-400/40', soft: 'bg-emerald-500/15' },
  fair: { bg: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-400/40', soft: 'bg-amber-400/15' },
  over: { bg: 'bg-rose-500', text: 'text-rose-300', ring: 'ring-rose-400/40', soft: 'bg-rose-500/15' },
};
