// Offline-first storage: every card (metadata + photos) lives in IndexedDB,
// so the collection opens with no connection at a show or in a shop.
import { createStore, get, set, del, values, clear, setMany } from 'idb-keyval';

const store = createStore('cardscout-db', 'cards');

export const getAllCards = async () => {
  const all = await values(store);
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};
export const getCard = (id) => get(id, store);
export const putCard = (card) => set(card.id, card, store);
export const deleteCard = (id) => del(id, store);
export const clearCards = () => clear(store);
export const putMany = (cards) => setMany(cards.map((c) => [c.id, c]), store);

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function blankCard(overrides = {}) {
  const now = Date.now();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    player: '',
    team: '',
    sport: '',
    year: '',
    set: '',
    cardNumber: '',
    parallel: '',
    rookie: false,
    auto: false,
    patch: false,
    refractor: false,
    serial: '', // e.g. "23/99"
    graded: false,
    grader: '',
    grade: '',
    certNumber: '',
    rawCondition: 'NM-MT',
    purchasePrice: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseSource: '',
    currentValue: '',
    valueSource: '',
    valueUpdatedAt: 0,
    valueHistory: [],
    frontImage: '',
    backImage: '',
    thumb: '',
    notes: '',
    status: 'owned', // owned | listed | sold
    ...overrides,
  };
}
