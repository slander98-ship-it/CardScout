// Device-local settings (localStorage). API keys entered here stay on this
// device and are sent only to this app's own /api functions over HTTPS.
const KEY = 'cardscout:settings';

export const DEFAULT_SETTINGS = {
  // Bring-your-own keys (optional if the host set server env vars)
  anthropicKey: '',
  sportsCardsProToken: '',
  ebayClientId: '',
  ebayClientSecret: '',

  // Selling-fee model used by the deal calculator (eBay trading-card defaults)
  feePercent: 13.25, // final value fee %
  feeFixed: 0.4, // per-order fee $
  shippingCost: 4.5, // your cost to ship (BMWT + supplies)

  // Deal indicator thresholds: asking price as a % of market value
  greatBuyMaxPct: 75, // at or below → Great Buy
  fairMaxPct: 100, // at or below → Fair, above → Overpriced

  notifyOnMoves: false,
  moveAlertPct: 10,
  autoRefreshDaily: false,
  lastAutoRefresh: 0,
};

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
