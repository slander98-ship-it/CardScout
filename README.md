# CardScout — Sports Card Appraisal & Collection PWA

Mobile-first Progressive Web App for card shops and shows: snap a card → AI identifies it → live market value → **Great Buy / Fair / Overpriced** verdict with flip math → save to your collection → write listings and export to eBay, Whatnot, Facebook and more.

Runs in Safari (iOS), Chrome (Android) and desktop browsers, installs to the home screen, and the collection works fully offline.

---

## 1. System architecture

```
 Phone / desktop browser (PWA)                    Vercel serverless (/api)             Upstream
 ┌───────────────────────────────┐   HTTPS JSON   ┌─────────────────────┐
 │ React 18 + Tailwind 4 (Vite)  │ ─────────────▶ │ /api/identify        │ ──▶ Gemini vision (free tier)
 │ Evaluator · Collection ·      │                │ /api/comps           │ ──▶ Gemini + Search grounding
 │ Export & Sell · Settings      │                │                      │     (sold comps)
 │ IndexedDB  (cards + photos)   │                │ /api/listing         │ ──▶ Gemini (free; Anthropic fallback)
 │ Service worker (offline shell)│                └─────────────────────┘
 └───────────────────────────────┘
```

**Why these APIs — everything is free**

| Need | Source | Notes |
|---|---|---|
| Card recognition / OCR | **Gemini vision** (`gemini-3.8-flash`, free tier, override with `GEMINI_MODEL`) — falls back to **Claude vision** (`claude-sonnet-5-5`, override with `ANTHROPIC_MODEL`) | Reads slab labels (grader, grade, cert #) and raw card design/back text. Returns a confidence score + notes; every field stays editable. |
| Market value | **Gemini + Google Search grounding** (free tier) | When a scan IDs a card, the app searches the web for recent *sold* prices (eBay sold, Heritage, Goldin, Fanatics Collect, 130point, PSA auction data) and approximates a value with linked sources. Labeled as an AI estimate — verify before paying up. |
| Sold comps (eBay Sold, 130point, Goldin, Fanatics Collect/PWCC) | Shown under the estimate + one-tap links | Every comp the AI cites links to its source. The **Market value override** field lets you type in a better comp you find yourself. |
| Listing copy | **Gemini** (free; Anthropic only as fallback) | Uses only the card's facts; built-in templates work with no key/offline. |

**Valuation logic** (`api/comps.js`): if the guide has a price for the card's exact grade, that's Market; Low/High blend ±15% with the trimmed active-ask range. With no guide match, Market = median active ask −12% (asks run above sold) and the app warns you to confirm sold comps. Outliers are removed with the IQR rule.

**Deal verdict** (`src/lib/pricing.js`): asking ÷ market. ≤ 75% = Great Buy, ≤ 100% = Fair, above = Overpriced (both thresholds editable). It also shows your net if you flipped it (after fee %, per-order fee, shipping), flip profit and margin, and the max offer that keeps a 20% margin.

**Storage**: everything (metadata + front/back photos) lives in IndexedDB on the device; `navigator.storage.persist()` is requested so the browser doesn't evict it. Backup/restore JSON moves a collection between devices.

**Keys**: set them as server env vars, *or* each user enters their own in Settings (stored on-device, sent only to this app's `/api` as headers). Set `REQUIRE_USER_KEYS=true` when you share the app publicly so strangers can't spend your API quota.

---

## 2. Folder structure

```
cardscout/
├── api/                         Vercel serverless functions
│   ├── _lib.js                  key resolution, Claude call, JSON helpers (not a route)
│   ├── identify.js              POST image → card fields (Claude vision)
│   ├── comps.js                 POST card → value range, grade ladder, active comps
│   └── listing.js               POST cards → AI titles/descriptions per platform
├── public/icons/                PWA + Apple touch icons, favicon
├── scripts/local-api.js         runs /api locally during `npm run dev`
├── src/
│   ├── main.jsx                 SW registration, install-prompt capture
│   ├── App.jsx                  tab shell + bottom nav
│   ├── index.css                Tailwind theme (dark, high-contrast)
│   ├── store/CollectionContext.jsx   collection state, portfolio metrics, re-pricing, alerts
│   ├── lib/
│   │   ├── db.js                IndexedDB store + card model
│   │   ├── image.js             on-device photo resize (full / AI / thumb)
│   │   ├── pricing.js           fees, deal verdict, robust stats
│   │   ├── cardText.js          titles, search queries, item specifics, comp links
│   │   ├── export.js            eBay / Whatnot / Facebook / generic CSV + JSON
│   │   ├── api.js               client for /api
│   │   ├── settings.js          device settings + defaults
│   │   └── notify.js            price-move notifications
│   ├── components/              BottomNav, CardForm, PhotoPicker, Comps, ui, icons
│   └── views/                   Evaluator, Collection, ExportSell, Settings
├── vite.config.js               PWA manifest + Workbox service worker config
└── .env.example
```

---

## 3. Run it

```bash
npm install
cp .env.example .env.local     # add whichever keys you have (or enter them in the app)
npm run dev                    # app + /api on http://localhost:5173
```

`npm run dev` prints a Network URL — open it on your phone on the same Wi-Fi. (Camera capture and install need HTTPS, so test those on the deployed URL.)

### Deploy to Vercel
1. Push the folder to a GitHub repo and import it in Vercel (framework auto-detects as **Vite**; `/api` becomes functions automatically).
2. Add environment variables from `.env.example`.
3. Deploy. Share the URL or the QR code from **Settings → Share the app**.

### Getting keys (just one — free)
- **Gemini**: aistudio.google.com/apikey → API key. Powers card recognition, market values + AI listing copy.

Without a key the app still works: identify stays dormant, and you can type values in the override field.

---

## 4. Feature map (spec → code)

| Spec item | Where |
|---|---|
| Manifest, service worker, offline, A2HS (iOS + Android) | `vite.config.js`, `index.html`, `main.jsx`, Settings install card |
| Native camera | `components/PhotoPicker.jsx` (`capture="environment"` — most reliable in iOS standalone mode) |
| Push notifications | `lib/notify.js` — alerts when a refresh moves a card ≥ X% (see limits below) |
| Evaluator: scan, OCR, value range, asking price, verdict, fees, comps links, save/discard | `views/Evaluator.jsx`, `components/Comps.jsx` |
| Collection: camera/manual add, all attributes, graded/raw, purchase details, front/back photos | `components/CardForm.jsx`, `views/Collection.jsx` |
| Portfolio value + P/L, auto-updating values | `store/CollectionContext.jsx` (Update button, optional daily auto-refresh, value history sparkline) |
| Filter/search: sport, year, graded/raw, player, value tier | `views/Collection.jsx` |
| Single/bulk selection, AI listing generator, per-platform exports, copy to clipboard, share photos | `views/ExportSell.jsx`, `lib/export.js` |
| Settings: API keys, fees/thresholds, backup/import, share QR | `views/Settings.jsx` |

---

## 5. Known limits & next steps

- **Photos in marketplace CSVs**: marketplaces need hosted image URLs; photos here live on the device. The CSV image columns fill from `card.imageUrl` when present. Next step: add Supabase Storage (or Vercel Blob) upload on save and set `imageUrl`/`backImageUrl`. Until then, add photos after upload or use **Share** (sends photos + listing text to the FB/eBay app).
- **eBay CSV**: uses the File Exchange "Add" format with category 261328 and ConditionID 2750 (graded) / 4000 (ungraded). eBay revises trading-card condition-descriptor columns periodically — if Seller Hub rejects a column, download its current template (Seller Hub → Reports → Uploads) and paste these columns in. Direct OAuth listing via the Sell Inventory API is the upgrade path.
- **Whatnot / Facebook CSV** column names follow their bulk-upload templates as of writing; verify against the current template on first use. **MySlabs and COMC have no public bulk import**, so they get a clean sheet plus the copy-listing tool.
- **Notifications** are local (fired after a refresh while the app is open or in the background). True push while the app is closed needs a Web Push server with VAPID keys + a scheduled job (e.g. Vercel Cron) re-pricing cards server-side — which in turn needs cloud sync. iOS only allows notifications for apps installed to the Home Screen (iOS 16.4+).
- **Cloud sync / multi-device / auth**: not included; the collection is per-device with JSON backup. Supabase (auth + Postgres + Storage) is the natural addition and would also unlock server-side price alerts.
- **Fee presets** (eBay 13.25% + $0.40, etc.) are approximations; marketplaces change fees — adjust in Settings.
