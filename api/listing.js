// POST /api/listing  { cards: [...], platform: 'ebay'|'whatnot'|'facebook'|'generic' }
// → { listings: { [id]: { title, description } } }  AI-written sales copy.
// Uses the free Gemini key first; Anthropic only as an optional fallback.
import { key, send, readBody, gemini, claude, parseJSON } from './_lib.js';

const STYLE = {
  ebay: 'eBay: title max 80 chars, keyword-dense in buyer search order (Year Set Player Parallel #Num RC Auto /Serial Grader Grade). Description plain text, factual, 3 short paragraphs.',
  whatnot: 'Whatnot: title max 60 chars, punchy. Description 2–3 short lines.',
  facebook: 'Facebook Marketplace: title max 100 chars, readable (not keyword-stuffed). Description friendly, mentions local pickup or shipping, 3–5 short lines.',
  generic: 'General marketplace (MySlabs/COMC): title max 80 chars. Description factual, 2 short paragraphs.',
};

const SYSTEM = `You write sports card listings that sell. Rules:
- Use ONLY facts provided. Never invent grades, serials, cert numbers, stats or pop reports.
- Graded cards: state grader, grade and cert number if given.
- Raw cards: describe condition as the seller's opinion, tell buyers to review photos. Never imply it would grade a 10.
- No hype words like "investment", "guaranteed", "gem mint potential". No emojis. No ALL CAPS sentences.
Respond with ONLY JSON: {"listings":[{"id":"...","title":"...","description":"..."}]}`;

const pick = (c) => {
  const { frontImage, backImage, thumb, valueHistory, ...rest } = c;
  return rest;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const geminiKey = key(req, 'x-gemini-key', 'GEMINI_API_KEY');
  const anthropicKey = key(req, 'x-anthropic-key', 'ANTHROPIC_API_KEY');
  if (!geminiKey && !anthropicKey) {
    return send(res, 400, { error: 'Add your free Gemini API key in Settings → API keys to generate AI listings.' });
  }

  try {
    const { cards = [], platform = 'ebay' } = await readBody(req);
    if (!cards.length) return send(res, 400, { error: 'No cards' });
    if (cards.length > 25) return send(res, 400, { error: 'Max 25 cards per request' });

    const prompt = `Platform style — ${STYLE[platform] || STYLE.generic}\n\nCards:\n${JSON.stringify(cards.map(pick))}`;
    const text = geminiKey
      ? await gemini(geminiKey, { system: SYSTEM, text: prompt, maxTokens: 800 + cards.length * 400 })
      : await claude(anthropicKey, {
          system: SYSTEM,
          maxTokens: 400 + cards.length * 350,
          content: [{ type: 'text', text: prompt }],
        });
    const out = parseJSON(text);
    const listings = {};
    for (const l of out.listings || []) listings[l.id] = { title: l.title, description: l.description };
    return send(res, 200, { listings });
  } catch (e) {
    return send(res, 500, { error: e.message || 'Listing generation failed' });
  }
}
