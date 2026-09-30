import { useMemo, useState } from 'react';
import { useCollection } from '../store/CollectionContext.jsx';
import { generateListings } from '../lib/api.js';
import { templateListing, cardHeadline, gradeLabel } from '../lib/cardText.js';
import { EXPORTERS, downloadText } from '../lib/export.js';
import { dataURLtoFile } from '../lib/image.js';
import { money } from '../lib/pricing.js';
import { Button, Sheet, Spinner, copyText, useToast, inputCls } from '../components/ui.jsx';
import { IconSparkle, IconCopy, IconShare, IconDownload, IconPlus, IconCheck } from '../components/icons.jsx';

const TITLE_LIMIT = { ebay: 80, whatnot: 60, facebook: 100, generic: 80, json: 80 };

const defaultPrice = (c) => {
  const v = Number(c.currentValue);
  if (!v) return '';
  // Psychological pricing: list ~10% over market to leave room for offers.
  const p = v * 1.1;
  return p < 20 ? Math.ceil(p) - 0.01 : Math.ceil(p / 5) * 5 - 0.01;
};

export default function ExportSell() {
  const { cards, saveCard } = useCollection();
  const toast = useToast();
  const [platform, setPlatform] = useState('ebay');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const queue = useMemo(() => cards.filter((c) => c.sellQueued && c.status !== 'sold'), [cards]);

  // listing for card: saved per-card, else template
  const listingOf = (c) => {
    const saved = c.listings?.[platform];
    const base = saved || templateListing(c);
    return { title: base.title, description: base.description, price: c.listPrice ?? defaultPrice(c) };
  };

  const updateListing = (c, patch) => {
    const cur = listingOf(c);
    const { price, ...rest } = patch;
    saveCard({
      ...c,
      ...(price !== undefined ? { listPrice: price } : {}),
      listings: { ...(c.listings || {}), [platform]: { title: cur.title, description: cur.description, ...rest } },
    });
  };

  async function aiWrite() {
    if (!queue.length) return;
    setBusy(true);
    try {
      const chunks = [];
      for (let i = 0; i < queue.length; i += 20) chunks.push(queue.slice(i, i + 20));
      let n = 0;
      for (const chunk of chunks) {
        const { listings } = await generateListings(chunk, platform === 'json' ? 'generic' : platform);
        for (const c of chunk) {
          if (listings[c.id]) {
            await saveCard({ ...c, listings: { ...(c.listings || {}), [platform]: listings[c.id] } });
            n++;
          }
        }
      }
      toast(`AI wrote ${n} listing${n === 1 ? '' : 's'}`, 'success');
    } catch (e) {
      toast(`${e.message} Using templates.`, 'error');
    }
    setBusy(false);
  }

  function exportFile() {
    const ex = EXPORTERS.find((e) => e.id === platform);
    const listings = Object.fromEntries(queue.map((c) => [c.id, listingOf(c)]));
    const text = ex.fn(queue, listings);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(text, `cardscout-${ex.id}-${stamp}.${ex.ext}`, ex.ext === 'json' ? 'application/json' : 'text/csv');
    toast(`Exported ${queue.length} card${queue.length === 1 ? '' : 's'} for ${ex.name}`, 'success');
  }

  async function markAllListed() {
    for (const c of queue) await saveCard({ ...c, status: 'listed' });
    toast('Marked as listed', 'success');
  }

  const ex = EXPORTERS.find((e) => e.id === platform);

  return (
    <div className="px-4 safe-top pb-44">
      <header className="pt-1">
        <h1 className="text-2xl font-bold tracking-tight">Export & Sell</h1>
        <p className="text-sm text-dim">Queue cards, write listings, export or copy-paste.</p>
      </header>

      {/* Platform picker */}
      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {EXPORTERS.map((e) => (
          <button
            key={e.id}
            onClick={() => setPlatform(e.id)}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${platform === e.id ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-panel2 text-zinc-300'}`}
          >
            {e.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-dim">{ex.desc}</p>

      {/* Queue */}
      <div className="mt-5 flex items-center justify-between">
        <h2 className="font-semibold">Sell queue <span className="text-dim num">({queue.length})</span></h2>
        <Button variant="secondary" size="sm" onClick={() => setPicking(true)}><IconPlus className="h-4 w-4" /> Add cards</Button>
      </div>

      {!queue.length ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-dim">
          Nothing queued. Tap <b className="text-white">Add cards</b> to pick from your collection.
        </div>
      ) : (
        <>
          <Button variant="secondary" className="mt-3 w-full" onClick={aiWrite} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <IconSparkle className="h-5 w-5 text-brand" />} {busy ? 'Writing listings…' : `AI-write ${queue.length} ${ex.name} listing${queue.length === 1 ? '' : 's'}`}
          </Button>
          <ul className="mt-4 space-y-4">
            {queue.map((c) => (
              <ListingCard
                key={c.id}
                card={c}
                listing={listingOf(c)}
                limit={TITLE_LIMIT[platform]}
                onChange={(p) => updateListing(c, p)}
                onRemove={() => saveCard({ ...c, sellQueued: false })}
              />
            ))}
          </ul>
        </>
      )}

      {queue.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur safe-bottom">
          <div className="mx-auto grid max-w-lg grid-cols-[1fr_2fr] gap-3">
            <Button variant="secondary" onClick={markAllListed}><IconCheck className="h-5 w-5" /> Listed</Button>
            <Button onClick={exportFile}><IconDownload className="h-5 w-5" /> Export {ex.name} {ex.ext.toUpperCase()}</Button>
          </div>
        </div>
      )}

      <PickSheet open={picking} onClose={() => setPicking(false)} />
    </div>
  );
}

function ListingCard({ card: c, listing, limit, onChange, onRemove }) {
  const toast = useToast();
  const [title, setTitle] = useState(listing.title);
  const [desc, setDesc] = useState(listing.description);
  const [price, setPrice] = useState(listing.price);
  const [seen, setSeen] = useState(listing);
  // Pick up AI rewrites / platform switches.
  if (listing.title !== seen.title || listing.description !== seen.description) {
    setSeen(listing);
    setTitle(listing.title);
    setDesc(listing.description);
  }

  const copy = async (text, what) => toast((await copyText(text)) ? `${what} copied` : 'Copy failed', 'success');
  const full = `${title}\n\n${desc}${price ? `\n\nPrice: ${money(price, 2)}` : ''}`;

  async function share() {
    const files = [c.frontImage && dataURLtoFile(c.frontImage, 'front.jpg'), c.backImage && dataURLtoFile(c.backImage, 'back.jpg')].filter(Boolean);
    const data = { title, text: full, ...(files.length ? { files } : {}) };
    try {
      if (navigator.canShare?.(data)) await navigator.share(data);
      else if (navigator.share) await navigator.share({ title, text: full });
      else {
        await copyText(full);
        toast('Sharing not supported here — listing copied instead');
      }
    } catch (e) {
      if (e.name !== 'AbortError') toast('Share failed', 'error');
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-panel p-3">
      <div className="flex gap-3">
        {c.thumb ? <img src={c.thumb} alt="" className="h-20 w-14 rounded-md object-cover" /> : <div className="h-20 w-14 rounded-md bg-panel2" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{cardHeadline(c)}</div>
          <div className="text-xs text-dim">{gradeLabel(c)} · value {money(c.currentValue)} · paid {money(c.purchasePrice)}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-dim">$</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              onBlur={() => onChange({ price })}
              inputMode="decimal"
              className="h-9 w-28 rounded-lg border border-line bg-panel2 px-2 num font-semibold outline-none focus:border-brand"
              aria-label="List price"
            />
            <button onClick={onRemove} className="ml-auto text-xs text-dim underline">Remove</button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="uppercase tracking-wide text-dim">Title</span>
          <span className={`num ${title.length > limit ? 'text-rose-400' : 'text-dim'}`}>{title.length}/{limit}</span>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => onChange({ title, description: desc })} className={inputCls} aria-label="Listing title" />
      </div>
      <div className="mt-3">
        <div className="mb-1 text-xs uppercase tracking-wide text-dim">Description</div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onChange({ title, description: desc })}
          rows={5}
          className={`${inputCls} h-auto py-2 text-sm leading-relaxed`}
          aria-label="Listing description"
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" onClick={() => copy(title, 'Title')}><IconCopy className="h-4 w-4" /> Title</Button>
        <Button variant="secondary" size="sm" onClick={() => copy(full, 'Title & description')}><IconCopy className="h-4 w-4" /> All</Button>
        <Button variant="secondary" size="sm" onClick={share}><IconShare className="h-4 w-4" /> Share</Button>
      </div>
    </li>
  );
}

function PickSheet({ open, onClose }) {
  const { cards, saveCard } = useCollection();
  const toast = useToast();
  const [sel, setSel] = useState(new Set());
  const [q, setQ] = useState('');
  const available = cards.filter((c) => c.status !== 'sold' && !c.sellQueued);
  const shown = available.filter((c) => !q || cardHeadline(c).toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = shown.length > 0 && shown.every((c) => sel.has(c.id));

  async function add() {
    for (const c of available.filter((c) => sel.has(c.id))) await saveCard({ ...c, sellQueued: true });
    toast(`Queued ${sel.size} card${sel.size === 1 ? '' : 's'}`, 'success');
    setSel(new Set());
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add to sell queue"
      footer={<Button className="w-full" disabled={!sel.size} onClick={add}>Queue {sel.size || ''} card{sel.size === 1 ? '' : 's'}</Button>}
    >
      {!available.length ? (
        <p className="py-8 text-center text-sm text-dim">No unqueued cards in your collection.</p>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className={`${inputCls} h-10`} aria-label="Filter cards" />
            <Button variant="secondary" size="sm" className="h-10 shrink-0" onClick={() => setSel((s) => { const n = new Set(s); shown.forEach((c) => (allOn ? n.delete(c.id) : n.add(c.id))); return n; })}>
              {allOn ? 'None' : 'All'}
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {shown.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-3 py-2.5">
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="h-5 w-5 accent-amber-400" />
                  {c.thumb ? <img src={c.thumb} alt="" className="h-12 w-9 rounded object-cover" /> : <div className="h-12 w-9 rounded bg-panel2" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{cardHeadline(c)}</span>
                    <span className="block text-xs text-dim">{gradeLabel(c)}</span>
                  </span>
                  <span className="num text-sm font-semibold">{money(c.currentValue)}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
