// POST /api/comps  { card }
// Market value from the user's free Gemini key + Google Search grounding.
// No eBay keys, no paid price guide, nothing else to configure.
//
// The model searches the web for recent SOLD prices (eBay sold listings,
// Heritage, Goldin, Fanatics Collect/PWCC, 130point, PSA auction prices) and
// returns an estimate with its sources. This is an AI estimate, not a price
// guide — the app labels it as such everywhere and links every source.
//
// Search grounding is free within Google's free tier (5,000 grounded
// requests/month shared across Gemini 3.x as of Sept 2026) — far above what
// one collector's scanning uses.
import { key, send, readBody, gemini, parseJSON } from './_lib.js';

function describe(card) {
  const bits = [card.year, card.set, card.player];
  if (card.cardNumber) bits.push('#' + card.cardNumber);
  if (card.parallel && card.parallel !== 'Base') bits.push(card.parallel);
  if (card.serial) bits.push('serial ' + card.serial);
  if (card.auto) bits.push('autograph');
  if (card.rookie) bits.push('rookie');
  if (card.graded && card.grader) bits.push(`${card.grader} ${card.grade} (cert ${card.certNumber || 'unknown'})`);
  else if (card.grade) bits.push('ungraded, seller-estimated grade ' + card.grade);
  else bits.push('ungraded (raw)');
  return bits.filter(Boolean).join(' ');
}

const SYSTEM = `You are a sports card market analyst. Use Google Search to find REAL recent sold prices for the card described. Prefer completed eBay sales, Heritage Auctions, Goldin, Fanatics Collect (PWCC), 130point and PSA Auction Prices from the last 12 months.

Rules:
- Only report prices you actually found in search results. Never invent a sale.
- Match the grade: a PSA 9 comp means nothing for a raw card. Say so if you can't find the exact grade.
- If you cannot find reliable sold data, return estimate null and explain why in notes.
- Respond with ONLY this JSON, no other text:
{"estimate": number|null, "low": number|null, "high": number|null, "confidence": "high"|"medium"|"low", "soldComps": [{"title": "...", "price": number, "date": "YYYY-MM", "source": "...", "url": "..."}], "notes": "one sentence"}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const { card } = await readBody(req);
  if (!card || !(card.player || card.set)) return send(res, 400, { error: 'Need at least a player or set to search comps.' });

  const geminiKey = key(req, 'x-gemini-key', 'GEMINI_API_KEY');
  if (!geminiKey) {
    return send(res, 400, { error: 'Add your free Gemini API key in Settings → API keys to get market values. You can still enter a value manually.' });
  }

  const desc = describe(card);
  let out;
  try {
    const r = await gemini(geminiKey, {
      system: SYSTEM,
      text: `Card: ${desc}\n\nFind recent sold prices and estimate its current market value. Return ONLY the JSON.`,
      maxTokens: 1500,
      grounding: true,
      sources: true,
    });
    out = parseJSON(r.text);
    out._sources = r.sources || [];
  } catch (e) {
    return send(res, 502, { error: `Market lookup failed: ${e.message}` });
  }

  const warnings = [];
  const soldComps = Array.isArray(out.soldComps) ? out.soldComps.filter((c) => c && Number(c.price) > 0).slice(0, 8) : [];
  if (!out.estimate || !Number(out.estimate)) {
    warnings.push(out.notes || 'Could not find reliable sold comps for this card — check the sold links below or enter a value manually.');
    return send(res, 200, {
      value: null, guide: null, active: null,
      soldComps, sources: out._sources,
      warnings, fetchedAt: Date.now(),
    });
  }

  const r2 = (n) => Math.round(Number(n) * 100) / 100;
  const value = {
    avg: r2(out.estimate),
    low: r2(out.low || out.estimate * 0.8),
    high: r2(out.high || out.estimate * 1.25),
    basis: `AI estimate from ${soldComps.length || 'web'} sold comp${soldComps.length === 1 ? '' : 's'} · ${out.confidence || 'medium'} confidence — verify before paying up`,
  };
  if (out.notes) warnings.push(out.notes);
  if ((out.confidence || 'medium') === 'low') warnings.push('Low confidence — thin or mismatched comps. Check eBay Sold / 130point before paying up.');

  return send(res, 200, {
    value, guide: null, active: null,
    soldComps, sources: out._sources,
    warnings, fetchedAt: Date.now(),
  });
}
