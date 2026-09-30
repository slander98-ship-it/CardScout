// POST /api/identify  { image: base64 JPEG (front), back?: base64 JPEG }
// → card fields read by a vision model from the photo, PLUS a market value
// estimate with sold comps — all in ONE model call, so a scan burns a single
// free-tier request instead of separate identify + comps calls.
// Uses a Gemini key (free tier) with Google Search grounding; falls back to
// Anthropic Claude vision (identification only, no market value).
import { key, send, readBody, claude, gemini, parseJSON } from './_lib.js';

const SYSTEM = `You are an expert sports card identifier and market analyst.
Given photos of a trading card (raw or in a grading slab), identify it precisely.
Read the slab label carefully when present: it states year, set, card number, player, variation and grade.
For raw cards, use the card design, logos, copyright line and back text to determine year and set.
Never guess a serial number or cert number you cannot read — leave it empty.

Then use Google Search to find REAL recent sold prices for the identified card: completed eBay sales, Heritage Auctions, Goldin, Fanatics Collect (PWCC), 130point and PSA Auction Prices from the last 12 months.
Only report prices you actually found in search results. Never invent a sale.
Match the grade: a PSA 9 comp means nothing for a raw card. Say so if you can't find the exact grade.
If you cannot find reliable sold data, set estimate to null and explain why in marketNotes.
Respond with ONLY a JSON object, no prose.`;

const SCHEMA = `{
  "player": "full player name",
  "team": "team on the card",
  "sport": "Baseball|Basketball|Football|Hockey|Soccer|UFC/MMA|Wrestling|Racing|Golf|Other",
  "year": "season/year as printed, e.g. 2018 or 2018-19",
  "set": "brand + set, e.g. Panini Prizm, Topps Chrome Update",
  "cardNumber": "card number without #",
  "parallel": "parallel/variant name, e.g. Silver Prizm, Gold Refractor, Base",
  "rookie": true/false,
  "auto": true/false,
  "patch": true/false,
  "refractor": true/false,
  "serial": "e.g. 23/99 if stamped and legible, else denominator like /99 if only that is legible, else empty",
  "graded": true/false,
  "grader": "PSA|BGS|SGC|CGC or empty",
  "grade": "numeric grade as shown, e.g. 10, 9.5, or Authentic",
  "certNumber": "cert number from the label if legible, else empty",
  "rawCondition": "for raw cards your visual estimate: GEM MT|NM-MT|NM|EX-MT|EX|VG|Poor; empty if graded",
  "confidence": 0-100 integer for the overall identification,
  "notes": "one short sentence: anything uncertain, or visible condition issues (corners, centering, surface)",
  "estimate": number|null, "estimateLow": number|null, "estimateHigh": number|null,
  "marketConfidence": "high|medium|low",
  "soldComps": [{"title": "...", "price": number, "date": "YYYY-MM", "source": "...", "url": "..."}],
  "marketNotes": "one sentence on the comps, or why none reliable was found"
}`;

const r2 = (n) => Math.round(Number(n) * 100) / 100;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const geminiKey = key(req, 'x-gemini-key', 'GEMINI_API_KEY');
  const anthropicKey = key(req, 'x-anthropic-key', 'ANTHROPIC_API_KEY');
  if (!geminiKey && !anthropicKey)
    return send(res, 400, { error: 'No API key. Add a free Gemini key in Settings → API Keys, or set GEMINI_API_KEY on the server.' });

  try {
    const { image, back } = await readBody(req);
    if (!image) return send(res, 400, { error: 'Missing image' });

    let card;
    let value = null;
    let soldComps = [];
    let sources = [];
    const warnings = [];

    if (geminiKey) {
      const r = await gemini(geminiKey, {
        system: SYSTEM,
        text: `Identify this card${back ? ' (front, then back)' : ''} and estimate its market value from recent sold prices. Return ONLY JSON matching:\n${SCHEMA}`,
        images: back ? [image, back] : [image],
        maxTokens: 1500,
        grounding: true,
        sources: true,
      });
      const out = parseJSON(r.text);
      sources = r.sources || [];
      const { estimate, estimateLow, estimateHigh, marketConfidence, marketNotes, ...fields } = out;
      card = fields;
      soldComps = Array.isArray(out.soldComps) ? out.soldComps.filter((c) => c && Number(c.price) > 0).slice(0, 8) : [];
      if (estimate && Number(estimate)) {
        value = {
          avg: r2(estimate),
          low: r2(estimateLow || estimate * 0.8),
          high: r2(estimateHigh || estimate * 1.25),
          basis: `AI estimate from ${soldComps.length || 'web'} sold comp${soldComps.length === 1 ? '' : 's'} · ${marketConfidence || 'medium'} confidence — verify before paying up`,
        };
      }
      if (marketNotes) warnings.push(marketNotes);
      if (!value) warnings.push('Could not find reliable sold comps — check the sold links below or enter a value manually.');
      else if ((marketConfidence || 'medium') === 'low') warnings.push('Low confidence — thin or mismatched comps. Check eBay Sold / 130point before paying up.');
    } else {
      const content = [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
        ...(back ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: back } }] : []),
        { type: 'text', text: `Identify this card${back ? ' (front, then back)' : ''}. Return JSON matching:\n${SCHEMA}` },
      ];
      const text = await claude(anthropicKey, { system: SYSTEM, content, maxTokens: 800 });
      card = parseJSON(text);
    }

    // Normalize
    for (const k of ['rookie', 'auto', 'patch', 'refractor', 'graded']) card[k] = Boolean(card[k]);
    if (card.grader) card.grader = String(card.grader).toUpperCase().replace('BECKETT', 'BGS');
    if (!card.graded) {
      card.grader = '';
      card.grade = '';
      card.certNumber = '';
    }
    card.cardNumber = String(card.cardNumber || '').replace(/^#/, '');
    return send(res, 200, { card, value, soldComps, sources, warnings, fetchedAt: Date.now() });
  } catch (e) {
    return send(res, 500, { error: e.message || 'Identification failed' });
  }
}
