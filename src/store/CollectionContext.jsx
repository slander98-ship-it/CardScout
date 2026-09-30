import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as db from '../lib/db.js';
import { fetchComps } from '../lib/api.js';
import { loadSettings, saveSettings } from '../lib/settings.js';
import { notify } from '../lib/notify.js';
import { cardHeadline } from '../lib/cardText.js';

const Ctx = createContext(null);
export const useCollection = () => useContext(Ctx);

export function CollectionProvider({ children }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettingsState] = useState(loadSettings);
  const [refresh, setRefresh] = useState(null); // { done, total } while running

  useEffect(() => {
    db.getAllCards().then((c) => {
      setCards(c);
      setLoading(false);
    });
  }, []);

  const setSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const saveCard = useCallback(async (card) => {
    const next = { ...card, updatedAt: Date.now() };
    await db.putCard(next);
    setCards((prev) => {
      const i = prev.findIndex((c) => c.id === next.id);
      if (i === -1) return [next, ...prev];
      const copy = prev.slice();
      copy[i] = next;
      return copy;
    });
    return next;
  }, []);

  const removeCard = useCallback(async (id) => {
    await db.deleteCard(id);
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const importCards = useCallback(async (incoming, { replace = false } = {}) => {
    if (replace) await db.clearCards();
    await db.putMany(incoming);
    setCards(await db.getAllCards());
  }, []);

  const clearAll = useCallback(async () => {
    await db.clearCards();
    setCards([]);
  }, []);

  /** Re-price one card from live comps. Returns { card, change } or throws. */
  const refreshValue = useCallback(
    async (card) => {
      const comps = await fetchComps(card);
      if (!comps.value?.avg) throw new Error('No market data found');
      const value = Math.round(comps.value.avg * 100) / 100;
      const prev = Number(card.currentValue) || 0;
      const history = [...(card.valueHistory || []), { t: Date.now(), v: value }].slice(-60);
      const updated = await saveCard({
        ...card,
        currentValue: value,
        valueSource: comps.value.basis,
        valueUpdatedAt: Date.now(),
        valueHistory: history,
      });
      return { card: updated, change: prev ? ((value - prev) / prev) * 100 : 0, prev };
    },
    [saveCard]
  );

  /** Re-price every owned card, one at a time to stay under API rate limits. */
  const refreshAll = useCallback(async () => {
    const targets = cards.filter((c) => c.status !== 'sold' && (c.player || c.set));
    if (!targets.length) return { updated: 0, failed: 0, movers: [] };
    let updated = 0;
    let failed = 0;
    const movers = [];
    setRefresh({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      try {
        const r = await refreshValue(targets[i]);
        updated++;
        if (r.prev && Math.abs(r.change) >= settings.moveAlertPct) movers.push(r);
      } catch {
        failed++;
      }
      setRefresh({ done: i + 1, total: targets.length });
      await new Promise((res) => setTimeout(res, 400));
    }
    setRefresh(null);
    setSettings({ lastAutoRefresh: Date.now() });
    if (settings.notifyOnMoves && movers.length) {
      const top = movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
      notify(
        `${movers.length} card${movers.length > 1 ? 's' : ''} moved ${settings.moveAlertPct}%+`,
        `${cardHeadline(top.card)}: ${top.change > 0 ? '+' : ''}${top.change.toFixed(0)}%`
      );
    }
    return { updated, failed, movers };
  }, [cards, refreshValue, settings, setSettings]);

  // Optional once-a-day auto refresh when the app opens online.
  useEffect(() => {
    if (loading || !settings.autoRefreshDaily || !navigator.onLine) return;
    if (Date.now() - (settings.lastAutoRefresh || 0) > 24 * 3600 * 1000 && cards.length) refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const portfolio = useMemo(() => {
    const owned = cards.filter((c) => c.status !== 'sold');
    const value = owned.reduce((s, c) => s + (Number(c.currentValue) || 0), 0);
    const cost = owned.reduce((s, c) => s + (Number(c.purchasePrice) || 0), 0);
    const pricedCost = owned.filter((c) => Number(c.currentValue)).reduce((s, c) => s + (Number(c.purchasePrice) || 0), 0);
    const pricedValue = owned.filter((c) => Number(c.purchasePrice)).reduce((s, c) => s + (Number(c.currentValue) || 0), 0);
    const pl = pricedValue - pricedCost;
    return { count: owned.length, value, cost, pl, plPct: pricedCost ? (pl / pricedCost) * 100 : 0 };
  }, [cards]);

  const api = { cards, loading, saveCard, removeCard, importCards, clearAll, refreshValue, refreshAll, refresh, portfolio, settings, setSettings };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
