import { money, money2, evaluateDeal, TIER_STYLES } from '../lib/pricing.js';
import { compLinks } from '../lib/cardText.js';
import { IconExternal } from './icons.jsx';

/** Low / Avg / High value strip. */
export function ValueRange({ value }) {
  if (!value) return null;
  return (
    <div>
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-line">
        {[
          ['Low', value.low],
          ['Market', value.avg],
          ['High', value.high],
        ].map(([k, v], i) => (
          <div key={k} className={`p-3 text-center ${i === 1 ? 'bg-panel2' : ''}`}>
            <div className="text-[11px] uppercase tracking-wide text-dim">{k}</div>
            <div className={`num font-bold ${i === 1 ? 'text-2xl text-white' : 'text-lg text-zinc-300'}`}>{money(v)}</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-xs text-dim">{value.basis}</div>
    </div>
  );
}

/** The "deal or no deal" verdict with flip math. */
export function DealMeter({ asking, market, settings }) {
  const d = evaluateDeal(asking, market, settings);
  if (!d) {
    return <div className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-dim">Enter the asking price to get a verdict</div>;
  }
  const st = TIER_STYLES[d.tier];
  // Gauge position: 50% of market at far left, 150% at far right.
  const pos = Math.max(0, Math.min(100, (d.pctOfMarket - 50)));
  return (
    <div className={`rounded-2xl p-4 ring-1 ${st.soft} ${st.ring}`} role="status" aria-live="polite">
      <div className="flex items-center justify-between">
        <div className={`rounded-full px-3 py-1 text-sm font-bold text-black ${st.bg}`}>{d.label}</div>
        <div className="num text-sm text-zinc-300">{d.pctOfMarket.toFixed(0)}% of market</div>
      </div>
      <div className="relative mt-4 h-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500">
        <div className="absolute -top-1.5 h-5.5 w-1.5 -translate-x-1/2 rounded-full bg-white shadow ring-2 ring-black" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-dim num">
        <span>50%</span>
        <span>{settings.greatBuyMaxPct}%</span>
        <span>{settings.fairMaxPct}%</span>
        <span>150%</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Net if flipped" value={money(d.net)} />
        <Stat label="Flip profit" value={money(d.flipProfit)} tone={d.flipProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
        <Stat label="Margin" value={`${d.flipMargin.toFixed(0)}%`} tone={d.flipMargin >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
      </div>
      <div className="mt-3 text-xs text-zinc-300">
        Offer up to <b className="num text-white">{money(d.targetBuy)}</b> to keep a 20% flip margin after {settings.feePercent}% + {money2(settings.feeFixed)} fees and {money2(settings.shippingCost)} shipping.
      </div>
    </div>
  );
}

const Stat = ({ label, value, tone = 'text-white' }) => (
  <div className="rounded-lg bg-black/25 p-2">
    <div className="text-[10px] uppercase tracking-wide text-dim">{label}</div>
    <div className={`num text-base font-bold ${tone}`}>{value}</div>
  </div>
);

export function ladderKey(c) {
  if (!c.graded) return 'Ungraded';
  const g = parseFloat(c.grade);
  if (g === 10) return `${c.grader} 10`;
  if (g === 9.5) return '9.5';
  return String(Math.floor(g));
}

/** Grade ladder from the price guide, to see what grading would be worth. */
export function GradeLadder({ ladder, current }) {
  // Explicit order: JS puts number-like keys ("7", "9") ahead of "Ungraded".
  const ORDER = ['Ungraded', '7', '8', '9', '9.5', 'PSA 10', 'BGS 10', 'SGC 10', 'CGC 10'];
  const rows = ORDER.filter((k) => ladder?.[k]).map((k) => [k, ladder[k]]);
  if (!rows.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {rows.map(([k, v]) => (
        <div key={k} className={`shrink-0 rounded-lg border px-3 py-2 text-center ${k === current ? 'border-brand bg-brand/10' : 'border-line bg-panel2'}`}>
          <div className="text-[10px] uppercase text-dim">{k}</div>
          <div className="num text-sm font-semibold">{money(v)}</div>
        </div>
      ))}
    </div>
  );
}

/** Sold comps found via web search — each links to its source. */
export function SoldComps({ soldComps, sources }) {
  const comps = soldComps || [];
  const extra = (sources || []).filter((s) => s?.url && !comps.some((c) => c.url === s.url)).slice(0, 6);
  if (!comps.length && !extra.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Sold comps</h3>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {comps.map((c, i) => (
          <li key={i}>
            <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2.5 active:bg-panel2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{c.title || c.source}</div>
                <div className="text-xs text-dim">{[c.source, c.date].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="num font-semibold">{money2(c.price)}</div>
            </a>
          </li>
        ))}
        {extra.map((s, i) => (
          <li key={`x${i}`}>
            <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 p-2.5 active:bg-panel2">
              <div className="min-w-0">
                <div className="truncate text-sm">{s.name}</div>
                {s.note && <div className="text-xs text-dim">{s.note}</div>}
              </div>
              <IconExternal className="h-4 w-4 shrink-0 text-dim" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResearchLinks({ card }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Check sold comps</h3>
      <div className="grid grid-cols-2 gap-2">
        {compLinks(card).map((l) => (
          <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-3 py-2.5 active:bg-line">
            <span>
              <span className="block text-sm font-medium">{l.name}</span>
              <span className="block text-[11px] text-dim">{l.note}</span>
            </span>
            <IconExternal className="h-4 w-4 text-dim" />
          </a>
        ))}
      </div>
    </div>
  );
}
