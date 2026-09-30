// Text helpers shared by the evaluator, collection and export modules.

export const SPORTS = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'UFC/MMA', 'Wrestling', 'Racing', 'Golf', 'Other'];
export const GRADERS = ['PSA', 'BGS', 'SGC', 'CGC'];
export const GRADES = ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6', '5', '4', '3', '2', '1', 'Authentic'];
export const RAW_CONDITIONS = ['GEM MT', 'NM-MT', 'NM', 'EX-MT', 'EX', 'VG', 'Poor'];

export function gradeLabel(c) {
  if (c.graded && c.grader) return `${c.grader} ${c.grade}`.trim();
  return c.rawCondition ? `Raw ${c.rawCondition}` : 'Raw';
}

export function attrTags(c) {
  const t = [];
  if (c.rookie) t.push('RC');
  if (c.auto) t.push('Auto');
  if (c.patch) t.push('Patch');
  if (c.refractor) t.push('Refractor');
  if (c.serial) t.push(c.serial.includes('/') ? `#${c.serial}` : `/${c.serial}`);
  return t;
}

/** Short headline for cards in lists: "2018 Prizm #280 Luka Doncic". */
export function cardHeadline(c) {
  return [c.year, c.set, c.cardNumber && `#${c.cardNumber}`, c.player].filter(Boolean).join(' ') || 'Untitled card';
}

/** Search string used for comps. Omits noisy fields (team, cert). */
export function compQuery(c) {
  const serialDenom = c.serial?.includes('/') ? `/${c.serial.split('/')[1]}` : c.serial ? `/${c.serial}` : '';
  return [
    c.year,
    c.set,
    c.player,
    c.cardNumber && `#${c.cardNumber}`,
    c.parallel,
    serialDenom,
    c.auto && 'auto',
    c.patch && 'patch',
    c.graded && c.grader ? `${c.grader} ${c.grade}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** eBay-style title, hard-capped at 80 characters (eBay's limit). */
export function listingTitle(c) {
  const parts = [
    c.year,
    c.set,
    c.player,
    c.parallel,
    c.cardNumber && `#${c.cardNumber}`,
    c.rookie && 'RC Rookie',
    c.auto && 'Auto',
    c.patch && 'Patch',
    c.serial && (c.serial.includes('/') ? `${c.serial}` : `/${c.serial}`),
    c.graded && c.grader ? `${c.grader} ${c.grade}` : '',
    c.team,
  ].filter(Boolean);
  let title = '';
  for (const p of parts) {
    const next = title ? `${title} ${p}` : p;
    if (next.length > 80) break;
    title = next;
  }
  return title;
}

/** Offline/no-AI fallback listing copy. */
export function templateListing(c) {
  const title = listingTitle(c);
  const cond = c.graded
    ? `Professionally graded ${c.grader} ${c.grade}${c.certNumber ? ` (cert #${c.certNumber})` : ''}. Slab is shown in photos — please review them, as the photos are part of the description.`
    : `Raw card in ${c.rawCondition || 'as-pictured'} condition in my opinion. Not professionally graded. Please review all photos for centering, corners, edges and surface.`;
  const specifics = itemSpecifics(c);
  const lines = Object.entries(specifics)
    .filter(([, v]) => v)
    .map(([k, v]) => `• ${k}: ${v}`)
    .join('\n');
  const description = `${title}\n\n${cond}\n\n${lines}\n\nShips securely in a penny sleeve + top loader${c.graded ? ' / slab protector' : ''}, bubble mailer with tracking. Card shown is the exact card you will receive.`;
  return { title, description, specifics };
}

export function itemSpecifics(c) {
  return {
    Sport: c.sport,
    'Player/Athlete': c.player,
    Team: c.team,
    Season: c.year,
    Manufacturer: manufacturerOf(c.set),
    Set: c.set,
    'Card Number': c.cardNumber,
    'Parallel/Variety': c.parallel,
    Features: [c.rookie && 'Rookie', c.refractor && 'Refractor', c.serial && 'Serial Numbered', c.patch && 'Patch'].filter(Boolean).join(', '),
    Autographed: c.auto ? 'Yes' : 'No',
    'Print Run': c.serial?.includes('/') ? c.serial.split('/')[1] : c.serial,
    Graded: c.graded ? 'Yes' : 'No',
    'Professional Grader': c.graded ? graderFullName(c.grader) : '',
    Grade: c.graded ? c.grade : '',
    'Certification Number': c.graded ? c.certNumber : '',
    'Card Condition': c.graded ? '' : c.rawCondition,
  };
}

export function manufacturerOf(set = '') {
  const s = set.toLowerCase();
  for (const m of ['Panini', 'Topps', 'Upper Deck', 'Bowman', 'Leaf', 'Fleer', 'Donruss', 'Score', 'Sage', 'Wild Card']) {
    if (s.includes(m.toLowerCase())) return m === 'Bowman' ? 'Topps' : m === 'Donruss' ? 'Panini' : m;
  }
  if (/prizm|select|mosaic|optic|national treasures|flawless|contenders|immaculate|spectra|obsidian|chronicles/.test(s)) return 'Panini';
  if (/chrome|finest|stadium club|heritage|allen|gypsy|dynasty|tribute|sterling/.test(s)) return 'Topps';
  return '';
}

export const graderFullName = (g) =>
  ({
    PSA: 'Professional Sports Authenticator (PSA)',
    BGS: 'Beckett Grading Services (BGS)',
    SGC: 'Sportscard Guaranty Corporation (SGC)',
    CGC: 'Certified Guaranty Company (CGC)',
  })[g] || g;

/** One-tap research links. These open the real sites; nothing is scraped. */
export function compLinks(c) {
  const q = encodeURIComponent(compQuery(c));
  const g = (site) => `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${compQuery(c)}`)}`;
  return [
    { name: 'eBay Sold', url: `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=261328&LH_Sold=1&LH_Complete=1`, note: 'Completed sales' },
    { name: 'eBay Active', url: `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=261328`, note: 'Live listings' },
    { name: '130point', url: 'https://130point.com/sales/', note: 'Paste search there' },
    { name: 'Goldin', url: g('goldin.co'), note: 'Auction results' },
    { name: 'Fanatics Collect (PWCC)', url: g('fanaticscollect.com'), note: 'Auction results' },
  ];
}

export function relTime(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
