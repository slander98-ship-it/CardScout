// Client for this app's own serverless functions (/api/*).
// If the user saved their own keys in Settings they ride along as headers;
// otherwise the server falls back to its environment variables.
import { loadSettings } from './settings.js';

function keyHeaders() {
  const s = loadSettings();
  const h = { 'Content-Type': 'application/json' };
  if (s.geminiKey) h['x-gemini-key'] = s.geminiKey;
  if (s.anthropicKey) h['x-anthropic-key'] = s.anthropicKey;
  if (s.ebayClientId) h['x-ebay-client-id'] = s.ebayClientId;
  if (s.ebayClientSecret) h['x-ebay-client-secret'] = s.ebayClientSecret;
  return h;
}

async function post(path, body) {
  if (!navigator.onLine) throw new Error("You're offline — valuations need a connection. Your collection still works.");
  const res = await fetch(path, { method: 'POST', headers: keyHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Drop photos/history before sending — keeps requests tiny (Vercel caps bodies at 4.5 MB). */
const meta = ({ frontImage, backImage, thumb, valueHistory, listings, ...rest }) => rest;

/** Vision ID: returns card fields + confidence + notes. */
export const identifyCard = (imageBase64, backBase64) => post('/api/identify', { image: imageBase64, back: backBase64 });

/** Market data: { value, guide, active, warnings }. */
export const fetchComps = (card) => post('/api/comps', { card: meta(card) });

/** AI listing copy for one or more cards: { listings: { [id]: {title, description} } }. */
export const generateListings = (cards, platform) => post('/api/listing', { cards: cards.map(meta), platform });
