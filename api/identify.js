// POST /api/identify  { image: base64 JPEG (front), back?: base64 JPEG }
// → card fields read by a vision model (Claude) from the photo.
import { key, send, readBody, claude, parseJSON } from './_lib.js';

const SYSTEM = `You are an expert sports card identifier and grader's assistant.
Given photos of a trading card (raw or in a grading slab), identify it precisely.
Read the slab label carefully when present: it states year, set, card number, player, variation and grade.
For raw cards, use the card design, logos, copyright line and back text to determine year and set.
Never guess a serial number or cert number you cannot read — leave it empty.
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
  "notes": "one short sentence: anything uncertain, or visible condition issues (corners, centering, surface)"
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const apiKey = key(req, 'x-anthropic-key', 'ANTHROPIC_API_KEY');
  if (!apiKey) return send(res, 400, { error: 'No Anthropic API key. Add one in Settings → API Keys, or set ANTHROPIC_API_KEY on the server.' });

  try {
    const { image, back } = await readBody(req);
    if (!image) return send(res, 400, { error: 'Missing image' });

    const content = [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
      ...(back ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: back } }] : []),
      { type: 'text', text: `Identify this card${back ? ' (front, then back)' : ''}. Return JSON matching:\n${SCHEMA}` },
    ];
    const text = await claude(apiKey, { system: SYSTEM, content, maxTokens: 800 });
    const card = parseJSON(text);

    // Normalize
    for (const k of ['rookie', 'auto', 'patch', 'refractor', 'graded']) card[k] = Boolean(card[k]);
    if (card.grader) card.grader = String(card.grader).toUpperCase().replace('BECKETT', 'BGS');
    if (!card.graded) {
      card.grader = '';
      card.grade = '';
      card.certNumber = '';
    }
    card.cardNumber = String(card.cardNumber || '').replace(/^#/, '');
    return send(res, 200, { card });
  } catch (e) {
    return send(res, 500, { error: e.message || 'Identification failed' });
  }
}
