import { useEffect, useState } from 'react';
import { CollectionProvider, useCollection } from './store/CollectionContext.jsx';
import { ToastProvider } from './components/ui.jsx';
import BottomNav, { TABS } from './components/BottomNav.jsx';
import Evaluator from './views/Evaluator.jsx';
import Collection from './views/Collection.jsx';
import ExportSell from './views/ExportSell.jsx';
import Settings from './views/Settings.jsx';

function initialTab() {
  const t = new URLSearchParams(window.location.search).get('tab');
  return TABS.some((x) => x.id === t) ? t : 'evaluate';
}

function Shell() {
  const [tab, setTab] = useState(initialTab);
  const { cards } = useCollection();
  const sellCount = cards.filter((c) => c.sellQueued && c.status !== 'sold').length;

  const goTo = (t) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    window.history.replaceState(null, '', url);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const onPop = () => setTab(initialTab());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      {/* Keep Evaluator mounted so an in-progress scan survives tab switches. */}
      <div hidden={tab !== 'evaluate'}><Evaluator goTo={goTo} /></div>
      {tab === 'collection' && <Collection />}
      {tab === 'sell' && <ExportSell />}
      {tab === 'settings' && <Settings />}
      <BottomNav tab={tab} onChange={goTo} sellCount={sellCount} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <CollectionProvider>
        <Shell />
      </CollectionProvider>
    </ToastProvider>
  );
}
