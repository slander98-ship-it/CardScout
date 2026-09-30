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
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

/** Minimal Gemini generateContent call (no SDK dependency). Free tier eligible. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function gemini(apiKey, { system, text, images, maxTokens = 800, grounding = false, sources = false }) {
  const parts = [];
  if (system || text) parts.push({ text: [system, text].filter(Boolean).join('\n\n') });
  for (const img of images || []) parts.push({ inline_data: { mime_type: 'image/jpeg', data: img } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      // JSON mode is skipped for grounded calls; the prompt asks for JSON and
      // parseJSON() extracts it — more reliable alongside the search tool.
      ...(grounding ? {} : { responseMimeType: 'application/json' }),
      maxOutputTokens: maxTokens,
      temperature: 0.2,
    },
    ...(grounding ? { tools: [{ google_search: {} }] } : {}),
  });
  // Google's free tier buckles under load — ride out transient 5xx "high
  // demand" spikes with backoff. For 429 quota hits, honor Google's own
  // "retry in Xs" hint exactly once, then stop: blind retries just burn the
  // quota faster. The caller surfaces a friendly "wait a minute" message.
  let lastErr = new Error('Gemini request failed');
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body,
    });
    const data = await r.json().catch(() => null);
    if (r.ok) {
      const out = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      if (!sources) return out;
      const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const seen = new Set();
      const srcs = [];
      for (const c of chunks) {
        const w = c.web;
        if (!w?.uri || seen.has(w.uri)) continue;
        seen.add(w.uri);
        let host = w.title || '';
        try { host = new URL(w.uri).hostname.replace(/^www\./, ''); } catch { /* keep title */ }
        srcs.push({ name: w.title || host, url: w.uri, note: host });
      }
      return { text: out, sources: srcs };
    }
    lastErr = new Error(data?.error?.message || `Gemini API error ${r.status}`);
    if (attempt === 2) break;
    if (r.status === 429) {
      const m = /retry in ([\d.]+)\s*s/i.exec(lastErr.message);
      if (attempt === 0 && m) {
        await sleep(Math.min(parseFloat(m[1]) * 1000 + 1500, 20000));
        continue;
      }
      lastErr = new Error("Google's free tier is rate-limited right now — it resets in under a minute. Give it a moment, then try again.");
      break;
    }
    // Retry anything else that smells transient: any 5xx, or Google's
    // "high demand / overloaded / try again later" messages regardless of status.
    const retryable = r.status >= 500 || /high demand|overloaded|try again later|temporar/i.test(lastErr.message);
    if (!retryable) break;
    await sleep(4000 * (attempt + 1)); // 4s, then 8s
  }
  throw lastErr;
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
