import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useCollection } from '../store/CollectionContext.jsx';
import { genericCSV, downloadText } from '../lib/export.js';
import { requestNotify, notifySupported, notify } from '../lib/notify.js';
import { Button, Field, Input, Toggle, Sheet, copyText, useToast } from '../components/ui.jsx';
import { IconShare, IconCopy, IconDownload, IconUpload, IconTrash } from '../components/icons.jsx';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export default function Settings() {
  return (
    <div className="space-y-6 px-4 safe-top pb-28">
      <header className="pt-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </header>
      <ShareSection />
      <KeysSection />
      <DealSection />
      <AlertsSection />
      <DataSection />
      <p className="pb-4 text-center text-xs text-dim">CardScout v1.0 · Your collection is stored on this device.</p>
    </div>
  );
}

const Card = ({ title, sub, children }) => (
  <section className="rounded-2xl border border-line bg-panel p-4">
    <h2 className="font-semibold">{title}</h2>
    {sub && <p className="mt-0.5 text-sm text-dim">{sub}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

function ShareSection() {
  const toast = useToast();
  const [qr, setQr] = useState('');
  const [installEvt, setInstallEvt] = useState(window.__installPrompt || null);
  const url = window.location.origin;

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 440, color: { dark: '#0b0d10', light: '#ffffff' } }).then(setQr);
    const h = () => setInstallEvt(window.__installPrompt);
    window.addEventListener('installpromptready', h);
    return () => window.removeEventListener('installpromptready', h);
  }, [url]);

  async function share() {
    const data = { title: 'CardScout', text: 'Scan and value sports cards on the spot — install it from this link:', url };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* cancelled */ }
    } else {
      await copyText(url);
      toast('Link copied', 'success');
    }
  }

  async function install() {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    window.__installPrompt = null;
    setInstallEvt(null);
  }

  return (
    <Card title="Share the app" sub="Other collectors scan this to open CardScout, then add it to their home screen.">
      <div className="flex gap-4">
        {qr && <img src={qr} alt={`QR code for ${url}`} className="h-36 w-36 rounded-xl" />}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="truncate rounded-lg bg-panel2 px-3 py-2 text-sm">{url.replace(/^https?:\/\//, '')}</div>
          <Button size="sm" onClick={share}><IconShare className="h-4 w-4" /> Share link</Button>
          <Button size="sm" variant="secondary" onClick={async () => { await copyText(url); toast('Link copied', 'success'); }}><IconCopy className="h-4 w-4" /> Copy</Button>
        </div>
      </div>
      {!isStandalone() && (
        <div className="mt-4 rounded-xl bg-panel2 p-3 text-sm">
          {installEvt ? (
            <Button className="w-full" onClick={install}><IconDownload className="h-5 w-5" /> Install CardScout</Button>
          ) : isIOS() ? (
            <p><b>Install on iPhone:</b> open this page in Safari, tap the Share button, then <b>Add to Home Screen</b>.</p>
          ) : (
            <p><b>Install:</b> in Chrome, open the ⋮ menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function SecretInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder={placeholder} autoComplete="off" spellCheck={false} className="pr-16" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-xs text-dim">{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

function KeysSection() {
  const { settings, setSettings } = useCollection();
  const toast = useToast();
  const timer = useRef(null);
  // Keys save automatically to this device on every keystroke — the toast
  // exists so it's obvious; there's no separate save button to hunt for.
  const savedNote = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => toast('Saved on this device ✓', 'success'), 1200);
  };
  const set = (k) => (v) => { setSettings({ [k]: v }); savedNote(); };
  return (
    <Card title="API keys" sub="Saved automatically on this device — no save button needed. Sent only to this app's own server.">
      <div className="space-y-4">
        <Field label="Gemini API key" hint="Free card recognition + AI listing copy · aistudio.google.com/apikey">
          <SecretInput value={settings.geminiKey} onChange={set('geminiKey')} placeholder="AIza…" />
        </Field>
        <Field label="eBay App ID (Client ID)" hint="Market comps · free at developer.ebay.com — create a production keyset once, paste the two values here">
          <SecretInput value={settings.ebayClientId} onChange={set('ebayClientId')} placeholder="YourApp-PRD-…" />
        </Field>
        <Field label="eBay Cert ID (Client Secret)" hint="Pairs with the App ID above">
          <SecretInput value={settings.ebayClientSecret} onChange={set('ebayClientSecret')} placeholder="PRD-…" />
        </Field>
        <Field label="Anthropic API key" hint="Optional backup for listings — Gemini above does it free · console.anthropic.com">
          <SecretInput value={settings.anthropicKey} onChange={set('anthropicKey')} placeholder="sk-ant-…" />
        </Field>
      </div>
    </Card>
  );
}

function NumField({ label, value, onChange, suffix, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="pr-10 num" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-dim">{suffix}</span>}
      </div>
    </Field>
  );
}

function DealSection() {
  const { settings: s, setSettings } = useCollection();
  const n = (k) => (v) => setSettings({ [k]: v === '' ? '' : Number(v) });
  return (
    <Card title="Deal calculator" sub="Fees and thresholds used for the Great Buy / Fair / Overpriced verdict.">
      <div className="grid grid-cols-3 gap-3">
        <NumField label="Sell fee" value={s.feePercent} onChange={n('feePercent')} suffix="%" />
        <NumField label="Per order" value={s.feeFixed} onChange={n('feeFixed')} suffix="$" />
        <NumField label="Shipping" value={s.shippingCost} onChange={n('shippingCost')} suffix="$" />
        <NumField label="Great Buy ≤" value={s.greatBuyMaxPct} onChange={n('greatBuyMaxPct')} suffix="%" />
        <NumField label="Fair ≤" value={s.fairMaxPct} onChange={n('fairMaxPct')} suffix="%" />
      </div>
      <p className="mt-3 text-xs text-dim">Thresholds are asking price as a % of market value. Defaults match eBay's trading-card fee (13.25% + $0.40).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          ['eBay', 13.25, 0.4],
          ['Whatnot', 8, 0.3],
          ['MySlabs', 5, 0],
          ['Cash / local', 0, 0],
        ].map(([name, pct, fixed]) => (
          <button key={name} onClick={() => setSettings({ feePercent: pct, feeFixed: fixed })} className="h-8 rounded-full border border-line bg-panel2 px-3 text-xs text-zinc-300">
            {name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-dim">Presets are approximate — marketplaces change fees; check theirs and adjust.</p>
    </Card>
  );
}

function AlertsSection() {
  const { settings, setSettings } = useCollection();
  const toast = useToast();
  const [perm, setPerm] = useState(notifySupported() ? Notification.permission : 'unsupported');

  async function enable(on) {
    if (on && perm !== 'granted') {
      const p = await requestNotify();
      setPerm(p);
      if (p !== 'granted') {
        toast(isIOS() && !isStandalone() ? 'On iPhone, install to Home Screen first, then enable alerts.' : 'Notifications were blocked in browser settings.', 'error');
        return;
      }
    }
    setSettings({ notifyOnMoves: on });
    if (on) notify('Alerts on', `You'll be notified when cards move ${settings.moveAlertPct}%+ on a refresh.`);
  }

  return (
    <Card title="Price alerts & refresh">
      <div className="flex flex-wrap gap-2">
        <Toggle label="Notify on big moves" checked={settings.notifyOnMoves} onChange={enable} />
        <Toggle label="Auto-refresh daily" checked={settings.autoRefreshDaily} onChange={(v) => setSettings({ autoRefreshDaily: v })} />
      </div>
      <div className="mt-3 w-40">
        <NumField label="Alert threshold" value={settings.moveAlertPct} onChange={(v) => setSettings({ moveAlertPct: Number(v) || 0 })} suffix="%" />
      </div>
      <p className="mt-3 text-xs text-dim">
        Auto-refresh runs when you open the app (once per day) and uses your API quota for every card. {perm === 'unsupported' && 'Notifications are not supported in this browser.'}
      </p>
    </Card>
  );
}

function DataSection() {
  const { cards, importCards, clearAll } = useCollection();
  const toast = useToast();
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  function backup() {
    const payload = { app: 'cardscout', version: 1, exportedAt: new Date().toISOString(), cards };
    downloadText(JSON.stringify(payload), `cardscout-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : data.cards;
      if (!Array.isArray(list) || !list.every((c) => c && c.id)) throw new Error('Not a CardScout backup');
      setPending(list);
    } catch (err) {
      toast(err.message || 'Could not read file', 'error');
    }
  }

  async function doImport(replace) {
    await importCards(pending, { replace });
    toast(`Imported ${pending.length} cards`, 'success');
    setPending(null);
  }

  const bytes = new Blob([JSON.stringify(cards)]).size;

  return (
    <Card title="Your data" sub={`${cards.length} cards · ${(bytes / 1024 / 1024).toFixed(1)} MB on this device, including photos.`}>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={backup} disabled={!cards.length}><IconDownload className="h-4 w-4" /> Backup (JSON)</Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><IconUpload className="h-4 w-4" /> Restore</Button>
        <Button variant="secondary" size="sm" className="col-span-2" disabled={!cards.length} onClick={() => downloadText(genericCSV(cards, {}), `cardscout-collection-${new Date().toISOString().slice(0, 10)}.csv`)}>
          <IconDownload className="h-4 w-4" /> Collection spreadsheet (CSV)
        </Button>
      </div>
      <p className="mt-3 text-xs text-dim">Back up regularly — clearing Safari/Chrome site data deletes the collection. Restore the JSON on any device to move it.</p>
      <div className="mt-4 border-t border-line pt-4">
        {confirmClear ? (
          <div className="flex gap-2">
            <Button variant="danger" size="sm" className="flex-1" onClick={async () => { await clearAll(); setConfirmClear(false); toast('Collection cleared'); }}>Delete all {cards.length} cards</Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} disabled={!cards.length}><IconTrash className="h-4 w-4" /> Clear collection</Button>
        )}
      </div>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Restore backup">
        <p className="text-sm">Found <b>{pending?.length}</b> cards in the file.</p>
        <div className="mt-4 grid gap-2 pb-2">
          <Button onClick={() => doImport(false)}>Merge with my {cards.length} cards</Button>
          <Button variant="danger" onClick={() => doImport(true)}>Replace everything</Button>
        </div>
      </Sheet>
    </Card>
  );
}
