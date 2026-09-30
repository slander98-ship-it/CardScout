// "My Collection" tab: portfolio summary, search, per-card detail with
// re-price / sell-queue / edit / delete actions.
import { useMemo, useState } from 'react';
import { useCollection } from '../store/CollectionContext.jsx';
import { cardHeadline, gradeLabel, attrTags, relTime } from '../lib/cardText.js';
import { money } from '../lib/pricing.js';
import { Button, Input, Sheet, Spinner, useToast, inputCls } from '../components/ui.jsx';
import CardForm from '../components/CardForm.jsx';
import { IconRefresh, IconSearch, IconTrash, IconEdit, IconPlus, IconCheck } from '../components/icons.jsx';

const STATUS_STYLE = {
  owned: 'bg-zinc-500/20 text-zinc-300',
  listed: 'bg-sky-500/20 text-sky-300',
  sold: 'bg-emerald-500/20 text-emerald-300',
};

export default function Collection() {
  const { cards, loading, saveCard, removeCard, refreshValue, refreshAll, refresh, portfolio } = useCollection();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? cards.filter((c) => cardHeadline(c).toLowerCase().includes(needle) || (c.notes || '').toLowerCase().includes(needle))
      : cards;
    return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [cards, q]);

  const detail = detailId ? cards.find((c) => c.id === detailId) : null;

  async function onRefreshAll() {
    if (refreshing || refresh) return;
    setRefreshing(true);
    try {
      const r = await refreshAll();
      toast(r.failed ? `Updated ${r.updated}, ${r.failed} failed` : `Updated ${r.updated} card${r.updated === 1 ? '' : 's'}`, r.failed ? 'error' : 'success');
    } catch (e) {
      toast(e.message || 'Refresh failed', 'error');
    }
    setRefreshing(false);
  }

  return (
    <div className="px-4 safe-top pb-28">
      <header className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Collection</h1>
          <p className="text-sm text-dim num">
            {portfolio.count} card{portfolio.count === 1 ? '' : 's'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefreshAll} disabled={refreshing || !!refresh || !cards.length}>
          {refreshing || refresh ? <Spinner className="h-4 w-4" /> : <IconRefresh className="h-4 w-4" />}
          {refresh ? ` ${refresh.done}/${refresh.total}` : ' Refresh values'}
        </Button>
      </header>

      {/* Portfolio strip */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-line bg-panel p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-dim">Value</div>
          <div className="num text-lg font-bold">{money(portfolio.value)}</div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-dim">Paid</div>
          <div className="num text-lg font-bold text-zinc-300">{money(portfolio.cost)}</div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-dim">P/L</div>
          <div className={`num text-lg font-bold ${portfolio.pl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {portfolio.pl >= 0 ? '+' : '−'}{money(Math.abs(portfolio.pl))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-dim" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your collection…"
          className={`${inputCls} pl-10`}
          aria-label="Search collection"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-dim">
          <Spinner /> Loading collection…
        </div>
      ) : !shown.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-dim">
          {cards.length ? 'No cards match your search.' : 'Nothing here yet — scan your first card and it lands here.'}
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {shown.map((c) => {
            const val = Number(c.currentValue) || 0;
            const paid = Number(c.purchasePrice) || 0;
            const pl = val && paid ? val - paid : null;
            return (
              <li key={c.id}>
                <button onClick={() => setDetailId(c.id)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel p-2.5 text-left active:bg-panel2">
                  {c.thumb ? (
                    <img src={c.thumb} alt="" className="h-16 w-11 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-16 w-11 shrink-0 rounded-md bg-panel2" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{cardHeadline(c)}</span>
                    <span className="mt-0.5 block text-xs text-dim">
                      {gradeLabel(c)}
                      {c.purchasePrice ? ` · paid ${money(paid)}` : ''}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[c.status] || STATUS_STYLE.owned}`}>
                        {c.status}
                      </span>
                      {c.sellQueued && c.status !== 'sold' && (
                        <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand">queued</span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block text-base font-bold">{money(val)}</span>
                    {pl != null && (
                      <span className={`num block text-xs ${pl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {pl >= 0 ? '+' : '−'}{money(Math.abs(pl))}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {detail && (
        <DetailSheet
          card={detail}
          onClose={() => setDetailId(null)}
          saveCard={saveCard}
          removeCard={removeCard}
          refreshValue={refreshValue}
        />
      )}
    </div>
  );
}

function DetailSheet({ card: c, onClose, saveCard, removeCard, refreshValue }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const val = Number(c.currentValue) || 0;
  const paid = Number(c.purchasePrice) || 0;
  const pl = val && paid ? val - paid : null;

  async function reprice() {
    setBusy(true);
    try {
      const r = await refreshValue(c);
      toast(`New value ${money(r.card.currentValue)} (${r.change >= 0 ? '+' : ''}${r.change.toFixed(0)}%)`, 'success');
    } catch (e) {
      toast(e.message || 'No market data found', 'error');
    }
    setBusy(false);
  }

  async function toggleQueue() {
    await saveCard({ ...c, sellQueued: !c.sellQueued });
    toast(c.sellQueued ? 'Removed from sell queue' : 'Queued for sale', 'success');
  }

  async function toggleSold() {
    const to = c.status === 'sold' ? 'owned' : 'sold';
    await saveCard({ ...c, status: to, ...(to === 'sold' ? { sellQueued: false } : {}) });
    toast(to === 'sold' ? 'Marked as sold' : 'Moved back to owned', 'success');
  }

  async function doDelete() {
    await removeCard(c.id);
    toast('Card deleted');
    onClose();
  }

  async function saveEdit() {
    await saveCard({ ...draft, updatedAt: Date.now() });
    setEditing(false);
    setDraft(null);
    toast('Card updated', 'success');
  }

  return (
    <Sheet open onClose={onClose} title={cardHeadline(c)}>
      {editing ? (
        <>
          <CardForm card={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
          <div className="mt-5 grid grid-cols-2 gap-2 pb-2">
            <Button variant="secondary" onClick={() => { setEditing(false); setDraft(null); }}>Cancel</Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-4">
            {c.frontImage ? (
              <img src={c.frontImage} alt="" className="w-28 shrink-0 self-start rounded-xl border border-line" />
            ) : c.thumb ? (
              <img src={c.thumb} alt="" className="w-28 shrink-0 self-start rounded-xl border border-line" />
            ) : (
              <div className="aspect-[5/7] w-28 shrink-0 rounded-xl bg-panel2" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm text-zinc-300">{[c.year, c.set].filter(Boolean).join(' ')}</div>
              <div className="text-sm text-dim">{[c.cardNumber && `#${c.cardNumber}`, c.parallel, c.team].filter(Boolean).join(' · ')}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-xs font-bold text-sky-300">{gradeLabel(c)}</span>
                {attrTags(c).map((t) => (
                  <span key={t} className="rounded-md bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">{t}</span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-panel2 p-2">
                  <div className="text-[10px] uppercase text-dim">Value</div>
                  <div className="num text-base font-bold">{money(val)}</div>
                </div>
                <div className="rounded-lg bg-panel2 p-2">
                  <div className="text-[10px] uppercase text-dim">Paid</div>
                  <div className="num text-base font-bold text-zinc-300">{money(c.purchasePrice)}</div>
                </div>
              </div>
              {pl != null && (
                <div className={`mt-2 text-sm num ${pl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {pl >= 0 ? '+' : '−'}{money(Math.abs(pl))} ({paid ? `${(((val - paid) / paid) * 100).toFixed(0)}%` : '—'})
                </div>
              )}
              <div className="mt-2 text-xs text-dim">
                {c.valueSource ? `via ${c.valueSource} · ` : ''}{c.valueUpdatedAt ? relTime(c.valueUpdatedAt) : 'no value yet'}
                {c.purchaseDate ? ` · bought ${c.purchaseDate}` : ''}
                {c.purchaseSource ? ` @ ${c.purchaseSource}` : ''}
              </div>
            </div>
          </div>

          {c.backImage && (
            <img src={c.backImage} alt="Card back" className="mt-3 w-28 rounded-xl border border-line" />
          )}
          {c.notes && <p className="mt-3 rounded-xl bg-panel2 p-3 text-sm text-zinc-300">{c.notes}</p>}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={reprice} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <IconRefresh className="h-4 w-4" />} Re-price
            </Button>
            <Button variant="secondary" onClick={toggleQueue}>
              {c.sellQueued ? <IconCheck className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
              {c.sellQueued ? 'Unqueue' : 'Queue to sell'}
            </Button>
            <Button variant="secondary" onClick={toggleSold}>
              {c.status === 'sold' ? 'Back to owned' : 'Mark sold'}
            </Button>
            <Button variant="secondary" onClick={() => { setDraft({ ...c }); setEditing(true); }}>
              <IconEdit className="h-4 w-4" /> Edit
            </Button>
          </div>

          <div className="mt-4 border-t border-line pt-4">
            {confirmDelete ? (
              <div className="flex gap-2">
                <Button variant="danger" size="sm" className="flex-1" onClick={doDelete}>
                  <IconTrash className="h-4 w-4" /> Delete this card
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <IconTrash className="h-4 w-4" /> Delete card
              </Button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
