// Shared helpers for the serverless functions. Files starting with "_" are
// not exposed as routes on Vercel.

/** Pick a key: user-supplied header first (bring-your-own-key), then env. */
export function key(req, header, envName) {
  const fromUser = req.headers[header];
  if (fromUser) return String(fromUser);
  // When the app is shared publicly, set REQUIRE_USER_KEYS=true so strangers
  // can't run up your API bills with your server keys.
  if (process.env.REQUIRE_USER_KEYS === 'true') return '';
  return process.env[envName] || '';
}

export function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/** Minimal Gemini generateContent call (no SDK dependency). Free tier eligible. */
export async function gemini(apiKey, { system, text, images, maxTokens = 800 }) {
  const parts = [];
  if (system || text) parts.push({ text: [system, text].filter(Boolean).join('\n\n') });
  for (const img of images || []) parts.push({ inline_data: { mime_type: 'image/jpeg', data: img } });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature: 0.2 },
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Gemini API error ${r.status}`);
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
}

/** Minimal Anthropic Messages API call (no SDK dependency). */
export async function claude(apiKey, { system, content, maxTokens = 1500 }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Anthropic API error ${r.status}`);
  return data.content?.map((b) => b.text || '').join('') || '';
}

/** Pull the first JSON object/array out of a model reply. */
export function parseJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(start, end + 1));
}
