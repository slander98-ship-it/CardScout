// POST /api/comps  { card }
// Market data from 100% free sources:
//
//  eBay Browse API — *active* listings, bucketed by grade from listing titles.
//  The anchor value is the median of the bucket matching the card's grade,
//  discounted 12% (asking prices run above sold prices).
//
//  Honest limitation: no free API exposes eBay *sold* prices — eBay shut down
//  the free Finding API (findCompletedItems) in February 2025 and the
//  Marketplace Insights API is restricted to approved partners. So the app
//  estimates from active asks and links out to eBay Sold / 130point (one tap
//  in the UI) for verifying real completed sales before paying up.
import { key, send, readBody } from './_lib.js';

// ---------- eBay Browse API ----------
let ebayToken = { value: '', exp: 0, id: '' };
async function ebayAppToken(id, secret) {
  if (ebayToken.value && ebayToken.id === id && Date.now() < ebayToken.exp) return ebayToken.value;
  const r = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || 'eBay auth failed');
  ebayToken = { value: d.access_token, exp: Date.now() + (d.expires_in - 120) * 1000, id };
  return d.access_token;
}

function ebayQuery(card) {
  const serialDenom = card.serial ? `/${String(card.serial).split('/').pop()}` : '';
  const base = [card.year, card.set, card.player, card.cardNumber && `#${card.cardNumber}`, card.parallel && card.parallel !== 'Base' ? card.parallel : '', serialDenom, card.auto && 'auto']
    .filter(Boolean)
    .join(' ');
  // Keep slab keywords in the query this time: graded listings get bucketed
  // separately, which powers the "Value by grade" ladder.
  if (card.graded && card.grader) return `${base} ${card.grader} ${card.grade}`;
  return base;
}

async function ebayActive(id, secret, card) {
  const token = await ebayAppToken(id, secret);
  const q = ebayQuery(card);
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&category_ids=261328&limit=60&filter=${encodeURIComponent('buyingOptions:{FIXED_PRICE}')}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } });
  const d = await r.json();
  if (!r.ok) throw new Error(d.errors?.[0]?.message || 'eBay search failed');
  const items = (d.itemSummaries || [])
    .filter((it) => it.price?.currency === 'USD')
    .map((it) => ({
      title: it.title,
      price: Number(it.price.value),
      shipping: Number(it.shippingOptions?.[0]?.shippingCost?.value || 0),
      url: it.itemWebUrl,
      image: it.thumbnailImages?.[0]?.imageUrl || it.image?.imageUrl || '',
      condition: it.condition || '',
      source: 'eBay',
    }));
  return { query: q, items, total: d.total || items.length };
}

// ---------- grade bucketing ----------
const LADDER_ORDER = ['Ungraded', '7', '8', '9', '9.5', 'PSA 10', 'BGS 10', 'SGC 10', 'CGC 10'];

/** Which ladder bucket a listing title belongs to. */
function titleBucket(title) {
  const t = ` ${title} `;
  let m = t.match(/\b(PSA|BGS|SGC|CGC)\s*10\b/i);
  if (m) return `${m[1].toUpperCase()} 10`;
  if (/\bBGS\s*9\.5\b/i.test(t)) return '9.5';
  m = t.match(/\b(PSA|BGS|SGC|CGC)\s*9\b/i);
  if (m) return '9';
  if (/\b(PSA|BGS|SGC|CGC)\s*8(?:\.5)?\b/i.test(t)) return '8';
  if (/\b(PSA|BGS|SGC|CGC)\s*7(?:\.5)?\b/i.test(t)) return '7';
  return 'Ungraded';
}

/** Which ladder bucket the card being valued belongs to. */
function cardBucket(card) {
  if (!card.graded) return 'Ungraded';
  const g = parseFloat(card.grade);
  const grader = (card.grader || '').toUpperCase();
  if (g === 10 && grader) return LADDER_ORDER.includes(`${grader} 10`) ? `${grader} 10` : 'Ungraded';
  if (g === 9.5) return '9.5';
  const f = String(Math.floor(g));
  return ['7', '8', '9'].includes(f) ? f : 'Ungraded';
}

function robustStats(prices) {
  const xs = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (!xs.length) return null;
  const q = (p) => {
    const i = (xs.length - 1) * p;
    const lo = Math.floor(i);
    return xs[lo] + (xs[Math.ceil(i)] - xs[lo]) * (i - lo);
  };
  let kept = xs;
  if (xs.length >= 5) {
    const iqr = q(0.75) - q(0.25);
    kept = xs.filter((x) => x >= q(0.25) - 1.5 * iqr && x <= q(0.75) + 1.5 * iqr);
  }
  const mid = Math.floor(kept.length / 2);
  return {
    low: kept[0],
    high: kept[kept.length - 1],
    median: kept.length % 2 ? kept[mid] : (kept[mid - 1] + kept[mid]) / 2,
    count: kept.length,
  };
}

const r2 = (n) => Math.round(n * 100) / 100;
const ASK_TO_SOLD = 0.88; // asking prices run ~12% above what cards actually sell for

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const { card } = await readBody(req);
  if (!card || !(card.player || card.set)) return send(res, 400, { error: 'Need at least a player or set to search comps.' });

  const ebayId = key(req, 'x-ebay-client-id', 'EBAY_CLIENT_ID');
  const ebaySecret = key(req, 'x-ebay-client-secret', 'EBAY_CLIENT_SECRET');
  if (!ebayId || !ebaySecret) {
    return send(res, 400, { error: 'No market-data source configured. Add your free eBay API keys in Settings → API keys (or as server env vars). You can still enter a value manually.' });
  }

  const warnings = [];
  let active;
  try {
    active = await ebayActive(ebayId, ebaySecret, card);
  } catch (e) {
    return send(res, 502, { error: `eBay lookup failed: ${e.message}` });
  }
  if (!active.items.length) {
    return send(res, 200, { value: null, guide: null, active: { query: active.query, total: 0, stats: null, items: [] }, warnings: ['No eBay listings matched — try fewer details or check the spelling.'], fetchedAt: Date.now() });
  }

  // Bucket listings by grade detected in the title.
  const buckets = {};
  for (const it of active.items) {
    const b = titleBucket(it.title);
    (buckets[b] = buckets[b] || []).push(it.price);
  }
  const bucketStats = {};
  for (const [b, prices] of Object.entries(buckets)) {
    if (prices.length >= 2) bucketStats[b] = robustStats(prices);
  }

  const want = cardBucket(card);
  const anchorStats = bucketStats[want] || null;
  const overall = robustStats(active.items.map((i) => i.price));
  const base = anchorStats || overall;
  if (!anchorStats) {
    warnings.push(want === 'Ungraded'
      ? 'Too few ungraded listings — estimate blends all results.'
      : `Too few ${want} listings — estimate blends all results. Check eBay Sold for the exact grade.`);
  }

  const anchor = base.median;
  const value = {
    avg: r2(anchor * ASK_TO_SOLD),
    low: r2(Math.min(anchor * 0.85, base.low)),
    high: r2(Math.max(anchor * 1.15, Math.min(base.high, anchor * 1.6))),
    basis: `Estimated from ${base.count} active eBay listing${base.count === 1 ? '' : 's'}${anchorStats ? ` (${want})` : ''} — asking prices minus 12%`,
  };
  warnings.push('Asking-price estimate, not sold data. Confirm with eBay Sold or 130point (links below) before paying up.');

  // "Value by grade" ladder, same response shape as before — estimated sold
  // basis (bucket median minus 12%), buckets with 2+ listings only.
  const ladder = {};
  for (const k of LADDER_ORDER) {
    if (bucketStats[k]) ladder[k] = r2(bucketStats[k].median * ASK_TO_SOLD);
  }
  const guide = {
    source: 'eBay',
    matched: `Active listings for “${active.query}”`,
    gradeLabel: want,
    price: value.avg,
    ladder,
  };

  return send(res, 200, {
    value,
    guide,
    active: { query: active.query, total: active.total, stats: overall, items: active.items.slice(0, 12) },
    warnings,
    fetchedAt: Date.now(),
  });
}
