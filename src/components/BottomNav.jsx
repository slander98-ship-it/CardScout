import { IconScan, IconCards, IconRocket, IconGear } from './icons.jsx';

export const TABS = [
  { id: 'evaluate', label: 'Evaluator', Icon: IconScan },
  { id: 'collection', label: 'Collection', Icon: IconCards },
  { id: 'sell', label: 'Export & Sell', Icon: IconRocket },
  { id: 'settings', label: 'Settings', Icon: IconGear },
];

export default function BottomNav({ tab, onChange, sellCount }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur safe-bottom">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-brand' : 'text-dim'}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-6 w-6" />
              {label}
              {id === 'sell' && sellCount > 0 && (
                <span className="absolute top-2 right-[calc(50%-22px)] min-w-5 h-5 rounded-full bg-brand px-1 text-[11px] leading-5 text-brand-ink font-bold num">{sellCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
