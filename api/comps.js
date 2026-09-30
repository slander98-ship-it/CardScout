// POST /api/comps  { card }
// Market data from two sources, merged into one value range:
//  1. SportsCardsPro API — price guide built from completed sales, per grade.
//  2. eBay Browse API — *active* listings (asking prices) for comps + links.
// eBay's sold-listings API (Marketplace Insights) is restricted to approved
// partners and 130point has no public API, so sold comps from those two are
// offered as one-tap links in the app instead of being scraped.
import { key, send, readBody } from './_lib.js';

// ---------- SportsCardsPro ----------
// Field names per https://www.sportscardspro.com/api-documentation (prices in pennies)
function scpField(card) {
  if (!card.graded) return { field: 'loose-price', label: 'Ungraded' };
  const g = parseFloat(card.grade);
  const grader = (card.grader || '').toUpperCase();
  if (g === 10) {
    const f = { PSA: 'manual-only-price', BGS: 'bgs-10-price', CGC: 'condition-17-price', SGC: 'condition-18-price' }[grader];
    return f ? { field: f, label: `${grader} 10` } : null;
  }
  if (g === 9.5) return { field: 'box-only-price', label: 'Grade 9.5' };
  if (g === 9) return { field: 'graded-price', label: 'Grade 9' };
  if (g >= 8) return { field: 'new-price', label: 'Grade 8–8.5' };
  if (g >= 7) return { field: 'cib-price', label: 'Grade 7–7.5' };
  return null; // guide doesn't break out grades below 7
}

function scpQuery(card) {
  return [card.year, card.set, card.player, card.parallel && card.parallel !== 'Base' ? card.parallel : '', card.cardNumber && `#${card.cardNumber}`]
    .filter(Boolean)
    .join(' ');
}

async function sportsCardsPro(token, card) {
  const map = scpField(card);
  const q = scpQuery(card);
  const url = `https://www.sportscardspro.com/api/product?t=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.status !== 'success') throw new Error(d['error-message'] || 'SportsCardsPro lookup failed');
  const cents = (f) => (d[f] ? d[f] / 100 : null);
  return {
    source: 'SportsCardsPro',
    matched: `${d['console-name'] || ''} — ${d['product-name'] || ''}`.trim(),
    gradeLabel: map?.label || null,
    price: map ? cents(map.field) : null,
    ladder: {
      Ungraded: cents('loose-price'),
      '7': cents('cib-price'),
      '8': cents('new-price'),
      '9': cents('graded-price'),
      '9.5': cents('box-only-price'),
      'PSA 10': cents('manual-only-price'),
      'BGS 10': cents('bgs-10-price'),
      'SGC 10': cents('condition-18-price'),
      'CGC 10': cents('condition-17-price'),
    },
    url: `https://www.sportscardspro.com/search-products?q=${encodeURIComponent(q)}&type=prices`,
  };
}

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
  if (card.graded && card.grader) return `${base} ${card.grader} ${card.grade}`;
  // Raw: exclude slabs so graded prices don't inflate the range
  return `${base} -PSA -BGS -SGC -CGC -graded`;
}

async function ebayActive(id, secret, card) {
  const token = await ebayAppToken(id, secret);
  const q = ebayQuery(card);
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&category_ids=261328&limit=40&filter=${encodeURIComponent('buyingOptions:{FIXED_PRICE}')}`;
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const { card } = await readBody(req);
  if (!card || !(card.player || card.set)) return send(res, 400, { error: 'Need at least a player or set to search comps.' });

  const scpToken = key(req, 'x-scp-token', 'SPORTSCARDSPRO_TOKEN');
  const ebayId = key(req, 'x-ebay-client-id', 'EBAY_CLIENT_ID');
  const ebaySecret = key(req, 'x-ebay-client-secret', 'EBAY_CLIENT_SECRET');

  const warnings = [];
  if (!scpToken && !(ebayId && ebaySecret)) {
    return send(res, 400, { error: 'No market-data source configured. Add a SportsCardsPro token and/or eBay API keys in Settings (or server env). You can still enter a value manually.' });
  }

  const [guideR, activeR] = await Promise.allSettled([
    scpToken ? sportsCardsPro(scpToken, card) : Promise.resolve(null),
    ebayId && ebaySecret ? ebayActive(ebayId, ebaySecret, card) : Promise.resolve(null),
  ]);
  const guide = guideR.status === 'fulfilled' ? guideR.value : null;
  const active = activeR.status === 'fulfilled' ? activeR.value : null;
  if (guideR.status === 'rejected') warnings.push(`SportsCardsPro: ${guideR.reason.message}`);
  if (activeR.status === 'rejected') warnings.push(`eBay: ${activeR.reason.message}`);
  if (guide && !guide.price) warnings.push(`Price guide has no figure for ${card.graded ? `${card.grader} ${card.grade}` : 'ungraded'} — check the match.`);

  const activeStats = active ? robustStats(active.items.map((i) => i.price)) : null;

  // Merge: sold-based guide price is the anchor. Active asks run above sold,
  // so without a guide we discount the active median by 12% and say so.
  let value = null;
  if (guide?.price) {
    value = {
      avg: guide.price,
      low: activeStats ? Math.min(guide.price * 0.85, activeStats.low) : guide.price * 0.85,
      high: activeStats ? Math.max(guide.price * 1.15, Math.min(activeStats.high, guide.price * 1.6)) : guide.price * 1.15,
      basis: 'Sold-price guide (SportsCardsPro)',
    };
  } else if (activeStats) {
    value = {
      avg: activeStats.median * 0.88,
      low: activeStats.low,
      high: activeStats.high,
      basis: `Estimated from ${activeStats.count} active eBay asks (−12% ask-to-sold)`,
    };
    warnings.push('No sold-price guide match — estimate is from asking prices. Confirm with eBay Sold / 130point before paying up.');
  }

  return send(res, 200, {
    value,
    guide,
    active: active ? { query: active.query, total: active.total, stats: activeStats, items: active.items.slice(0, 12) } : null,
    warnings,
    fetchedAt: Date.now(),
  });
}
