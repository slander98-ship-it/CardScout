import { useState } from 'react';
import { useCollection } from '../store/CollectionContext.jsx';
import { identifyCard, fetchComps } from '../lib/api.js';
import { base64Of } from '../lib/image.js';
import { blankCard } from '../lib/db.js';
import { cardHeadline, gradeLabel, attrTags } from '../lib/cardText.js';
import { money } from '../lib/pricing.js';
import { usePhotoPicker } from '../components/PhotoPicker.jsx';
import CardForm from '../components/CardForm.jsx';
import { ValueRange, DealMeter, GradeLadder, SoldComps, ResearchLinks, ladderKey } from '../components/Comps.jsx';
import { Button, Field, Input, Sheet, Spinner, useToast, useOnline } from '../components/ui.jsx';
import { IconCamera, IconUpload, IconEdit, IconRefresh, IconWifiOff, IconCheck } from '../components/icons.jsx';

export default function Evaluator({ goTo }) {
  const { saveCard, settings } = useCollection();
  const toast = useToast();
  const online = useOnline();

  const [phase, setPhase] = useState('idle'); // idle | identifying | review
  const [card, setCard] = useState(blankCard);
  const [idInfo, setIdInfo] = useState(null); // { confidence, notes } | { error }
  const [comps, setComps] = useState(null);
  const [compsState, setCompsState] = useState('idle'); // idle | loading | error
  const [compsError, setCompsError] = useState('');
  const [asking, setAsking] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const patch = (p) => setCard((c) => ({ ...c, ...p }));

  async function runComps(target) {
    setCompsState('loading');
    setCompsError('');
    try {
      const r = await fetchComps(target);
      setComps(r);
      setCompsState('idle');
      if (r.warnings?.length) toast(r.warnings[0]);
    } catch (e) {
      setComps(null);
      setCompsError(e.message);
      setCompsState('error');
    }
  }

  async function onPhoto(p) {
    const draft = blankCard({ frontImage: p.full, thumb: p.thumb });
    setCard(draft);
    setComps(null);
    setAsking('');
    setManualValue('');
    setIdInfo(null);
    setPhase('identifying');
    try {
      // Identify now returns the card AND its market value + sold comps in one
      // call — no second request needed, which keeps free-tier quota burn to
      // a single request per scan.
      const res = await identifyCard(base64Of(p.ai));
      const { card: found, value, soldComps, sources, warnings } = res;
      const { confidence, notes, ...fields } = found;
      const merged = { ...draft, ...fields };
      setCard(merged);
      setIdInfo({ confidence, notes });
      setPhase('review');
      if (value || (soldComps && soldComps.length) || (sources && sources.length)) {
        setComps({ value, soldComps: soldComps || [], sources: sources || [], warnings: warnings || [], fetchedAt: res.fetchedAt });
        setCompsState('idle');
        if (warnings && warnings.length) toast(warnings[0]);
      } else {
        runComps(merged);
      }
    } catch (e) {
      setIdInfo({ error: e.message });
      setEditing(true);
      setPhase('review');
    }
  }

  const picker = usePhotoPicker(onPhoto);

  function startManual() {
    setCard(blankCard());
    setIdInfo(null);
    setComps(null);
    setAsking('');
    setManualValue('');
    setEditing(true);
    setPhase('review');
  }

  function discard() {
    setPhase('idle');
    setCard(blankCard());
    setComps(null);
    setEditing(false);
  }

  const market = Number(manualValue) || comps?.value?.avg || 0;

  async function confirmSave(purchase) {
    setSaving(true);
    await saveCard({
      ...card,
      ...purchase,
      currentValue: market ? Math.round(market * 100) / 100 : '',
      valueSource: manualValue ? 'Manual' : comps?.value?.basis || '',
      valueUpdatedAt: market ? Date.now() : 0,
      valueHistory: market ? [{ t: Date.now(), v: market }] : [],
    });
    setSaving(false);
    toast('Saved to My Collection', 'success');
    discard();
    goTo('collection');
  }

  // ---------- IDLE: camera-first home ----------
  if (phase === 'idle') {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col px-5 safe-top pb-24">
        {picker.inputs}
        <header className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Deal or No Deal</h1>
            <p className="text-sm text-dim">Snap a card, get the verdict.</p>
          </div>
          {!online && (
            <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-300">
              <IconWifiOff className="h-4 w-4" /> Offline
            </span>
          )}
        </header>

        <button
          onClick={picker.openCamera}
          disabled={!online}
          className="relative mt-6 flex flex-1 min-h-72 flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed border-brand/50 bg-brand/5 active:bg-brand/10 disabled:opacity-40"
        >
          <div className="relative flex h-40 w-28 items-center justify-center rounded-xl border-2 border-brand/70">
            <div className="scan-line absolute inset-x-0 h-0.5 bg-brand shadow-[0_0_12px_#fbbf24]" />
            <IconCamera className="h-10 w-10 text-brand" />
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold">Tap to scan a card</div>
            <div className="mt-1 text-sm text-dim">Front photo is all it needs · raw or slabbed · fill the frame, avoid glare</div>
          </div>
        </button>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={picker.openLibrary} disabled={!online}>
            <IconUpload className="h-5 w-5" /> Upload photo
          </Button>
          <Button variant="secondary" onClick={startManual}>
            <IconEdit className="h-5 w-5" /> Type it in
          </Button>
        </div>
        {!online && <p className="mt-3 text-center text-sm text-dim">Scanning needs a connection. Your collection works offline.</p>}
      </div>
    );
  }

  // ---------- IDENTIFYING ----------
  if (phase === 'identifying') {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-6 px-6 pb-24">
        <div className="relative w-48 overflow-hidden rounded-xl border border-line">
          <img src={card.thumb} alt="Scanned card" className="w-full" />
          <div className="scan-line absolute inset-x-0 h-1 bg-brand shadow-[0_0_16px_#fbbf24]" />
        </div>
        <div className="flex items-center gap-3 text-lg">
          <Spinner /> Reading the card…
        </div>
        <p className="max-w-xs text-center text-sm text-dim">Player, set, year, grade and cert are pulled from the photo — market value comes along in the same lookup.</p>
      </div>
    );
  }

  // ---------- REVIEW ----------
  const tags = attrTags(card);
  return (
    <div className="px-4 safe-top pb-44">
      <header className="flex items-center justify-between pt-1 pb-3">
        <button onClick={discard} className="text-sm text-dim">← New scan</button>
        <h1 className="text-base font-semibold">Evaluation</h1>
        <button onClick={() => setEditing((e) => !e)} className="text-sm text-brand">{editing ? 'Done' : 'Edit'}</button>
      </header>

      {idInfo?.error && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Couldn't auto-identify: {idInfo.error}
          {/api key/i.test(idInfo.error) ? (
            <button onClick={() => goTo('settings')} className="ml-1 font-semibold text-brand underline">Add your API key in Settings →</button>
          ) : (
            <span> Fill in the details below, then check comps.</span>
          )}
        </div>
      )}

      {/* Identity card */}
      {!editing && (
        <div className="flex gap-4 rounded-2xl border border-line bg-panel p-3">
          {card.thumb ? <img src={card.thumb} alt="" className="w-24 self-start rounded-lg" /> : <div className="aspect-[5/7] w-24 rounded-lg bg-panel2" />}
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold leading-tight">{card.player || 'Unknown player'}</div>
            <div className="text-sm text-zinc-300">{[card.year, card.set].filter(Boolean).join(' ')}</div>
            <div className="text-sm text-dim">
              {[card.cardNumber && `#${card.cardNumber}`, card.parallel, card.team].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${card.graded ? 'bg-sky-500/20 text-sky-300' : 'bg-zinc-500/20 text-zinc-300'}`}>
                {gradeLabel(card)}
                {card.certNumber ? ` · #${card.certNumber}` : ''}
              </span>
              {tags.map((t) => (
                <span key={t} className="rounded-md bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">{t}</span>
              ))}
            </div>
            {idInfo?.confidence != null && (
              <div className="mt-2 text-xs text-dim">
                AI confidence <b className={idInfo.confidence >= 80 ? 'text-emerald-300' : 'text-amber-300'}>{idInfo.confidence}%</b>
                {idInfo.notes ? ` — ${idInfo.notes}` : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border border-line bg-panel p-4">
          <CardForm card={card} onChange={patch} sections={['photos', 'identity', 'attributes', 'grading']} />
          <Button
            className="mt-5 w-full"
            onClick={() => {
              setEditing(false);
              runComps(card);
            }}
            disabled={!card.player && !card.set}
          >
            <IconRefresh className="h-5 w-5" /> Get market value
          </Button>
        </div>
      )}

      {/* Asking price + verdict */}
      {!editing && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-line bg-panel p-4 space-y-4">
            <Field label="Seller's asking price">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl text-dim">$</span>
                <input
                  value={asking}
                  onChange={(e) => setAsking(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-16 w-full rounded-xl border border-line bg-panel2 pl-9 pr-3 text-3xl font-bold num outline-none focus:border-brand"
                  aria-label="Asking price"
                />
              </div>
            </Field>

            {market > 0 && <DealMeter asking={asking} market={market} settings={settings} />}

            {compsState === 'loading' && (
              <div className="flex items-center gap-3 text-sm text-dim"><Spinner /> Pulling market data…</div>
            )}
            {compsState === 'error' && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {compsError}
                <button onClick={() => runComps(card)} className="ml-2 underline">Retry</button>
              </div>
            )}
            {comps?.value && <ValueRange value={comps.value} />}
            {comps?.guide?.matched && <div className="text-xs text-dim">Comps: {comps.guide.matched}</div>}

            <Field label="Market value override" hint="Saw a better comp on 130point or eBay Sold? Enter it here — it replaces the estimate.">
              <Input value={manualValue} onChange={(e) => setManualValue(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder={comps?.value?.avg ? money(comps.value.avg) : 'e.g. 120'} />
            </Field>

          </div>

          {comps?.guide && (
            <div className="rounded-2xl border border-line bg-panel p-4">
              <h3 className="mb-2 text-sm font-semibold">Value by grade</h3>
              <GradeLadder ladder={comps.guide.ladder} current={ladderKey(card)} />
            </div>
          )}

          {(comps?.soldComps?.length > 0 || comps?.sources?.length > 0) && (
            <div className="rounded-2xl border border-line bg-panel p-4">
              <SoldComps soldComps={comps.soldComps} sources={comps.sources} />
            </div>
          )}

          <div className="rounded-2xl border border-line bg-panel p-4">
            <ResearchLinks card={card} />
          </div>
        </div>
      )}

      {/* Sticky quick actions, thumb-reachable */}
      {!editing && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur safe-bottom">
          <div className="mx-auto grid max-w-lg grid-cols-[1fr_2fr] gap-3">
            <Button variant="secondary" onClick={discard}>Discard</Button>
            <Button onClick={() => setSaving('sheet')}>
              <IconCheck className="h-5 w-5" /> Save to Collection
            </Button>
          </div>
        </div>
      )}

      <SaveSheet
        open={saving === 'sheet' || saving === true}
        busy={saving === true}
        defaultPrice={asking}
        headline={cardHeadline(card)}
        onClose={() => setSaving(false)}
        onSave={confirmSave}
      />
    </div>
  );
}

function SaveSheet({ open, busy, defaultPrice, headline, onClose, onSave }) {
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('');
  const [seeded, setSeeded] = useState(false);
  if (open && !seeded) {
    setPrice(defaultPrice || '');
    setSeeded(true);
  }
  if (!open && seeded) setSeeded(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Save to Collection"
      footer={
        <Button className="w-full" disabled={busy} onClick={() => onSave({ purchasePrice: price, purchaseDate: date, purchaseSource: source })}>
          {busy ? <Spinner /> : 'Save card'}
        </Button>
      }
    >
      <p className="mb-4 text-sm text-dim">{headline}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid ($)">
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Bought from / where" className="col-span-2">
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Card show, shop, seller…" />
        </Field>
      </div>
    </Sheet>
  );
}
