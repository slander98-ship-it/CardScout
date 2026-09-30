// Marketplace exporters. Each takes cards + a per-card listing
// ({ title, description, price }) and returns CSV text.
//
// Photos: marketplaces need *hosted* image URLs. Photos in this app live on
// your device, so image columns are filled only when a card has `imageUrl`
// set (e.g. after adding cloud storage). Otherwise add photos in the
// marketplace after upload, or use the Share button to send them.
import { itemSpecifics, graderFullName } from './cardText.js';

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCSV = (headers, rows) => [headers.map(esc).join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\r\n');

/**
 * eBay Seller Hub Reports / File Exchange "Add" template.
 * Category 261328 = Sports Trading Card Singles.
 * ConditionID 2750 = Graded, 4000 = Ungraded (trading-card condition model).
 * eBay periodically changes trading-card condition-descriptor columns — if an
 * upload errors, download the current template from Seller Hub → Reports →
 * Uploads and copy these columns into it.
 */
export function ebayCSV(cards, listings) {
  const headers = [
    '*Action(SiteID=US|Country=US|Currency=USD|Version=1193)',
    'CustomLabel',
    '*Category',
    '*Title',
    '*ConditionID',
    'C:Sport',
    'C:Player/Athlete',
    'C:Team',
    'C:Season',
    'C:Manufacturer',
    'C:Set',
    'C:Card Number',
    'C:Parallel/Variety',
    'C:Features',
    'C:Autographed',
    'C:Print Run',
    'C:Graded',
    'C:Professional Grader',
    'C:Grade',
    'C:Certification Number',
    'PicURL',
    '*Description',
    '*Format',
    '*Duration',
    '*StartPrice',
    '*Quantity',
    '*Location',
    'BestOfferEnabled',
  ];
  const rows = cards.map((c) => {
    const l = listings[c.id];
    const sp = itemSpecifics(c);
    return {
      [headers[0]]: 'Add',
      CustomLabel: c.id.slice(0, 8),
      '*Category': '261328',
      '*Title': l.title.slice(0, 80),
      '*ConditionID': c.graded ? '2750' : '4000',
      'C:Sport': sp.Sport,
      'C:Player/Athlete': sp['Player/Athlete'],
      'C:Team': sp.Team,
      'C:Season': sp.Season,
      'C:Manufacturer': sp.Manufacturer,
      'C:Set': sp.Set,
      'C:Card Number': sp['Card Number'],
      'C:Parallel/Variety': sp['Parallel/Variety'],
      'C:Features': sp.Features,
      'C:Autographed': sp.Autographed,
      'C:Print Run': sp['Print Run'],
      'C:Graded': sp.Graded,
      'C:Professional Grader': c.graded ? graderFullName(c.grader) : '',
      'C:Grade': sp.Grade,
      'C:Certification Number': sp['Certification Number'],
      PicURL: c.imageUrl || '',
      '*Description': l.description.replace(/\n/g, '<br>'),
      '*Format': 'FixedPrice',
      '*Duration': 'GTC',
      '*StartPrice': Number(l.price || 0).toFixed(2),
      '*Quantity': '1',
      '*Location': l.location || '',
      BestOfferEnabled: '1',
    };
  });
  return toCSV(headers, rows);
}

/** Whatnot bulk-listing CSV (Seller Hub → Inventory → Bulk upload). */
export function whatnotCSV(cards, listings) {
  const headers = ['Category', 'Sub Category', 'Title', 'Description', 'Quantity', 'Type', 'Price', 'Shipping Profile', 'Offerable', 'Hazmat', 'Condition', 'Cost Per Item', 'SKU', 'Image URL 1', 'Image URL 2'];
  const rows = cards.map((c) => {
    const l = listings[c.id];
    return {
      Category: 'Sports Cards',
      'Sub Category': c.sport || '',
      Title: l.title,
      Description: l.description,
      Quantity: 1,
      Type: 'Buy it Now',
      Price: Math.round(Number(l.price || 0)),
      'Shipping Profile': c.graded ? '4-8 oz' : '0-1 oz',
      Offerable: 'TRUE',
      Hazmat: 'Not Hazmat',
      Condition: c.graded ? 'Graded' : 'Ungraded',
      'Cost Per Item': c.purchasePrice || '',
      SKU: c.id.slice(0, 8),
      'Image URL 1': c.imageUrl || '',
      'Image URL 2': c.backImageUrl || '',
    };
  });
  return toCSV(headers, rows);
}

/** Facebook / Meta Commerce Manager catalog data-feed CSV. */
export function facebookCSV(cards, listings) {
  const headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'google_product_category'];
  const rows = cards.map((c) => {
    const l = listings[c.id];
    return {
      id: c.id.slice(0, 8),
      title: l.title.slice(0, 150),
      description: l.description,
      availability: 'in stock',
      condition: 'used',
      price: `${Number(l.price || 0).toFixed(2)} USD`,
      link: l.link || '',
      image_link: c.imageUrl || '',
      brand: itemSpecifics(c).Manufacturer || 'Trading Card',
      google_product_category: '3865', // Collectibles > Collectible Trading Cards > Sports Trading Cards
    };
  });
  return toCSV(headers, rows);
}

/** Generic sheet for MySlabs, COMC, card-show inventory, or your own spreadsheet. */
export function genericCSV(cards, listings) {
  const headers = ['SKU', 'Title', 'Player', 'Team', 'Sport', 'Year', 'Set', 'Card #', 'Parallel', 'Rookie', 'Auto', 'Patch', 'Serial', 'Graded', 'Grader', 'Grade', 'Cert #', 'Raw Condition', 'Purchase Price', 'Purchase Date', 'Source', 'Current Value', 'List Price', 'Description'];
  const rows = cards.map((c) => {
    const l = listings[c.id] || {};
    return {
      SKU: c.id.slice(0, 8),
      Title: l.title || '',
      Player: c.player,
      Team: c.team,
      Sport: c.sport,
      Year: c.year,
      Set: c.set,
      'Card #': c.cardNumber,
      Parallel: c.parallel,
      Rookie: c.rookie ? 'Y' : '',
      Auto: c.auto ? 'Y' : '',
      Patch: c.patch ? 'Y' : '',
      Serial: c.serial,
      Graded: c.graded ? 'Y' : 'N',
      Grader: c.grader,
      Grade: c.grade,
      'Cert #': c.certNumber,
      'Raw Condition': c.graded ? '' : c.rawCondition,
      'Purchase Price': c.purchasePrice,
      'Purchase Date': c.purchaseDate,
      Source: c.purchaseSource,
      'Current Value': c.currentValue,
      'List Price': l.price || '',
      Description: l.description || '',
    };
  });
  return toCSV(headers, rows);
}

export function listingsJSON(cards, listings) {
  return JSON.stringify(
    cards.map((c) => {
      const { frontImage, backImage, thumb, ...meta } = c;
      return { ...meta, listing: listings[c.id] };
    }),
    null,
    2
  );
}

export const EXPORTERS = [
  { id: 'ebay', name: 'eBay', desc: 'Seller Hub bulk upload (File Exchange format)', fn: ebayCSV, ext: 'csv' },
  { id: 'whatnot', name: 'Whatnot', desc: 'Bulk listing CSV', fn: whatnotCSV, ext: 'csv' },
  { id: 'facebook', name: 'Facebook', desc: 'Commerce Manager catalog feed', fn: facebookCSV, ext: 'csv' },
  { id: 'generic', name: 'MySlabs / COMC / Sheet', desc: 'No public bulk import — clean sheet + copy tool', fn: genericCSV, ext: 'csv' },
  { id: 'json', name: 'JSON', desc: 'Everything, for developers / other tools', fn: listingsJSON, ext: 'json' },
];

export function downloadText(text, filename, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
