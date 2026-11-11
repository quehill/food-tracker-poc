# Build Prompt: Minimal Macro Tracker (Web Proof of Concept)

You are building a proof of concept for a **minimal, fast macro-tracking app**. It starts as a mobile-first web app (installable PWA) and is expected to later become an iOS app, so keep the architecture portable. Read this whole document before writing code. If something is ambiguous, pick the simplest reasonable option, record the decision in `DECISIONS.md`, and keep going. Only stop to ask if a choice would be expensive to reverse.

---

## 1. Product intent

The owner tried existing food trackers and found them bloated, ad-heavy, and paywalled. This app does a few things well and nothing else.

**Design stance (non-negotiable):**
- Logging a repeat food must take as few taps as possible. Speed is the product.
- No ads, no paywalls, no accounts, no social, no gamification, no streaks, no AI features.
- No micronutrient tracking. Track calories, protein, carbs, fat only.
- No required meal categories (breakfast/lunch/dinner). The owner practices intermittent fasting. Entries are a simple timestamped list; an optional label is fine but never required.
- Every number shown must be explainable (how it was calculated).

## 2. Scope

### In scope for the POC
1. **Macro tracking**: daily totals of calories, protein, carbs, fat against user-set targets.
2. **Foods**: create/edit/delete custom foods with macros per serving.
3. **Meals**: compose a meal from multiple foods with quantities (example: a turkey sandwich = bread + turkey + cheese), with auto-summed macros. Save, edit, delete, and log meals.
4. **Quick re-add**: Recents and Favorites lists so a commonly eaten food or meal is logged in one or two taps.
5. **Food lookup from an open database**: search USDA FoodData Central and import a result into My Foods.
6. **Daily log**: view by date, edit/delete entries, adjust quantity.
7. **Local-only storage** with JSON backup export/import and CSV export of the log.

### Explicitly out of scope for the POC
- **Barcode scanning** (planned for a later phase; see roadmap and keep the lookup layer ready for it).
- User accounts, sync, multi-device.
- Open Food Facts integration (later, alongside barcode).
- Weight log, charts, adaptive targets, exercise tracking, wearable integrations.
- Photo/voice/AI logging, meal planning, recipe URL import, micronutrients.

## 3. Proposed architecture

### Stack
- **Vite + React + TypeScript** (strict mode), single-page app, **mobile-first** layout (design for ~390px wide first).
- **Dexie (IndexedDB)** for local persistence.
- **Zustand** or plain React context for UI state. Keep it light.
- **Vitest** for unit tests; **Playwright** optional for one or two smoke tests.
- **vite-plugin-pwa** for installability and offline shell.
- Keep dependencies minimal. Justify any addition in `DECISIONS.md`.

### Layering (this is what keeps the iOS pivot cheap)
```
src/
  domain/        # pure TypeScript: types, macro math, validation. NO browser/React imports.
  data/          # repository interfaces + Dexie implementation (swappable later)
  providers/     # food lookup providers behind one interface (USDA now; OpenFoodFacts/barcode later)
  ui/            # React components and screens
  app/           # routing, state wiring
```
Rules:
- `domain/` is pure and fully unit tested. All macro calculations live here and nowhere else.
- UI talks to repositories, never directly to Dexie.
- Lookup providers implement a shared interface so adding Open Food Facts and barcode lookup later requires no UI rewrite:
```ts
interface FoodProvider {
  id: 'usda' | 'off' | string;
  search(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]>;
  // reserved for later phase:
  getByBarcode?(code: string): Promise<FoodSearchResult | null>;
}
```

### Data model (TypeScript sketch)
```ts
type Macros = { calories: number; protein: number; carbs: number; fat: number }; // grams except calories

interface Food {
  id: string;                 // uuid
  name: string;
  brand?: string;
  source: 'custom' | 'usda' | 'off';
  sourceId?: string;          // e.g. USDA fdcId
  gtin?: string;              // reserved for barcode phase
  // Macros stored for ONE serving
  serving: { label: string; grams?: number };   // e.g. { label: "1 slice", grams: 28 }
  macrosPerServing: Macros;
  favorite: boolean;
  lastUsedAt?: number;
  useCount: number;
  createdAt: number; updatedAt: number;
}

interface MealItem { foodId: string; servings: number }  // quantity as number of servings
interface Meal {
  id: string; name: string;
  items: MealItem[];
  favorite: boolean; lastUsedAt?: number; useCount: number;
  createdAt: number; updatedAt: number;
  // Totals are DERIVED from items; do not persist them as truth.
}

interface LogEntry {
  id: string;
  date: string;               // local calendar date "YYYY-MM-DD" (the user's timezone)
  timestamp: number;
  kind: 'food' | 'meal';
  refId: string;              // food or meal id (may be deleted later)
  name: string;               // SNAPSHOT of the name at log time
  servings: number;           // multiplier applied to the snapshot
  macros: Macros;             // SNAPSHOT of total macros at log time (already multiplied)
  label?: string;
}

interface Targets { calories: number; protein: number; carbs?: number; fat?: number }
```

**Important design decisions:**
- **Log entries snapshot their macros.** Editing a food or meal later must never silently rewrite history.
- **Meal totals are derived**, always computed from current ingredient data, then snapshotted when logged.
- Store a `grams` value on a serving whenever known so the UI can offer "enter by grams" as well as "enter by servings" (servings = grams / serving.grams).
- Calories may be entered directly. Show a soft warning (not a block) when calories differ from `4*protein + 4*carbs + 9*fat` by more than ~15%.
- Round for display only (calories to whole numbers, macros to 0.1 g). Never round stored values.

### USDA FoodData Central integration
- Endpoint: `https://api.nal.usda.gov/fdc/v1/foods/search` with `api_key` query param. Free key from the USDA FoodData Central signup; **1,000 requests/hour per key** (the `DEMO_KEY` is ~30/hour, fine only for initial development).
- Read the key from `VITE_USDA_API_KEY` (never commit it; provide `.env.example`). Note in the README that a client-side key is visible to users, acceptable for the POC; plan a thin proxy before any public release.
- Query both generic and branded data (`dataType`: Foundation, SR Legacy, Branded). Rank generic results (Foundation/SR Legacy) first for basic ingredients like turkey or bread.
- Map nutrients by ID: energy kcal = **1008**, protein = **1003**, fat = **1004**, carbohydrate = **1005**. Some foods lack energy (1008); fall back to Atwater calculation and mark as estimated.
- USDA values are per 100 g for most data types; convert into the app's per-serving model using the item's `servingSize`/`householdServingFullText` when present, otherwise default to a 100 g serving.
- Debounce search (300 ms), cancel in-flight requests with `AbortSignal`, cache results in memory for the session, handle 429/network errors with a clear message and manual-entry fallback.
- Importing a result creates a `Food` in My Foods (source `usda`, `sourceId` = fdcId), editable afterward.

### Deployment (GitHub Pages)
The app is a static site with no backend, deployed to **GitHub Pages using GitHub Actions** (the "GitHub Actions" Pages source, not a `gh-pages` branch). The owner tests on an iPhone via the deployed HTTPS URL, so deployment is set up in Phase 0, not at the end.

Requirements:
- **Workflow** at `.github/workflows/deploy.yml`:
  - Triggers: push to `main` (deploy) and pull requests (checks only, **no deploy on PRs**).
  - Steps: checkout, set up Node (use the version in `.nvmrc`), `npm ci`, `npm run check`, `npm run build`, then upload the `dist` folder with `actions/upload-pages-artifact` and publish with `actions/deploy-pages`.
  - Permissions: `contents: read`, `pages: write`, `id-token: write`; use the `github-pages` environment and a `concurrency` group so deploys don't overlap.
  - Inject `VITE_USDA_API_KEY` at build time from a repository secret of the same name. The build must still succeed (with lookup disabled and a clear in-app message) if the secret is missing.
- **Base path:** project sites are served from `https://<user>.github.io/<repo>/`. Configure Vite's `base` from an environment variable (for example `VITE_BASE_PATH`, set to `/<repo>/` in CI and `/` locally). Every asset URL, the PWA manifest `start_url` and `scope`, and the service worker scope must respect it. This is the most common failure point.
- **Routing:** GitHub Pages has no SPA rewrite rules. Use **hash-based routing** (for example React Router's `createHashRouter`) so deep links and refreshes never 404.
- **PWA for iOS:** provide a valid web manifest, 192 and 512 px icons (including a maskable icon), a 180 px `apple-touch-icon`, and the `apple-mobile-web-app-capable` and related meta tags so Add to Home Screen behaves like an app. The service worker must not serve stale builds indefinitely: show a small "Update available, tap to refresh" prompt when a new version is ready.
- **Owner setup steps** (the agent cannot do these; document them clearly in the README): (1) in the repo, Settings > Pages > Source: **GitHub Actions**; (2) Settings > Secrets and variables > Actions > add `VITE_USDA_API_KEY`; (3) note that GitHub Pages on a private repository may require a paid GitHub plan, so a free account typically means a public repo.
- **Security note for the README:** the USDA key is compiled into the public bundle. Acceptable for a free key on a personal POC; a thin proxy is the planned fix before wider release. Never commit the key; commit `.env.example` only.
- **Testing on iPhone** (document in README): open the Pages URL in Safari, Share > Add to Home Screen, and test from the installed icon. The Safari tab and the installed app keep separate storage on iOS, so export a JSON backup before moving between them.

## 4. Screens and behavior

Bottom tab bar: **Today · Add · Foods · Meals · Settings**.

1. **Today (home)**
   - Date switcher (prev/next, tap to pick a date).
   - Progress summary: calories and protein most prominent, carbs and fat secondary, each as "consumed / target" with remaining.
   - Chronological list of entries with name, servings, macros. Tap to edit servings; swipe or button to delete.
   - Prominent **"Add"** button.
2. **Add**
   - Top: search box that filters across My Foods + Meals; below it, a lookup toggle/button "Search USDA".
   - Default view shows **Favorites** and **Recents** (sorted by recency and use count) for one-tap logging.
   - Tapping an item opens a minimal quantity sheet (default 1 serving, plus a grams input if available), then **Log**. A one-tap "log 1 serving" shortcut should exist directly from the list.
3. **Foods**: list/search custom and imported foods; create/edit form (name, optional brand, serving label, optional serving grams, calories, protein, carbs, fat, favorite toggle); delete with confirmation (warn if used in meals).
4. **Meals**: list; builder screen to name the meal, add ingredients from My Foods (or search USDA inline), set quantity per ingredient, and see live totals; save; "Log this meal" with a servings multiplier.
5. **Settings**: daily targets, units display, **Export JSON backup / Import JSON**, **Export log CSV**, "persist storage" status, app version.

**UX requirements**
- Mobile-first, thumb-reachable controls, large tap targets (44 px minimum), numeric keypad for number inputs (`inputmode="decimal"`).
- Fast: lists render instantly from local storage; no spinners for local data.
- Clean and calm visual design: light/dark via `prefers-color-scheme`, high contrast, no clutter.
- Accessible: labeled inputs, focus states, semantic HTML.

## 5. Seed data (for development and tests)

Provide a dev-only "load sample data" action with approximate values:
| Food | Serving | Cal | P | C | F |
|---|---|---|---|---|---|
| Premier Protein shake | 1 bottle | 160 | 30 | 5 | 3 |
| Hard-boiled egg | 1 large | 70 | 6 | 0.5 | 5 |
| Banana | 1 medium | 105 | 1.3 | 27 | 0.4 |
| Deli turkey | 3 oz (85 g) | 90 | 18 | 2 | 1 |
| Sandwich bread | 2 slices | 140 | 6 | 26 | 2 |
| Cheese slice | 1 slice | 70 | 4 | 0.5 | 6 |

Sample meal: **Turkey sandwich** = 2 slices bread + 85 g turkey + 1 cheese slice (about 300-330 calories, mid-20s grams of protein).

## 6. Testing and quality bar
- **Unit tests (Vitest)** for `domain/`: serving-to-grams conversion, meal total derivation, snapshotting on log, calorie sanity check, rounding, date handling (local-date boundaries, including midnight and DST changes).
- Tests for the USDA mapper using recorded fixture responses (no live network in tests).
- Tests for JSON export/import round trip (export, wipe, import, data identical).
- One Playwright smoke test (optional): create food, build meal, log it, see totals update.
- TypeScript strict, ESLint and Prettier configured, no `any` without justification.
- README with setup, env vars, scripts, and architecture overview.

## 7. Known risks to handle
- **iOS Safari may evict site storage** after a period of non-use when the site isn't installed to the home screen. Mitigate: call `navigator.storage.persist()`, prompt the user to install the PWA, show a "last backup" reminder in Settings, and make JSON export/import robust and versioned (`schemaVersion`) with Dexie migrations.
- **USDA data quirks**: inconsistent serving info and missing energy values. Always let the user edit after import; mark estimated calories.
- **Client-side API key exposure**: acceptable for POC only.
- **Local-date handling**: store the user's local calendar date string on entries, not just UTC timestamps.
- **GitHub Pages base path and caching**: a wrong `base` produces a blank page or 404 assets; a service worker can pin users to an old build. Verify on the deployed URL, not just locally, and keep the update prompt working.

## 8. Roadmap and acceptance criteria

Work in phases. Commit at the end of each phase with a clear message. Do not start the next phase until the current one's acceptance criteria pass.

**Phase 0: Scaffold**
Vite/React/TS, lint/format/test tooling, PWA config, folder layout, Dexie setup, `npm run check` (lint + typecheck + test), hash routing, the GitHub Pages deploy workflow, base path configuration, and placeholder PWA icons.
*Done when:* app boots, empty tabs render, `npm run check` passes, and, after the owner completes the Pages setup steps in the README, a push to `main` publishes the app to the GitHub Pages URL, where it loads on an iPhone and can be added to the home screen. Local dev still works at `/`.

**Phase 1: Core logging**
Domain types and macro math, Foods CRUD, Today screen, quick-add logging, edit/delete entries, targets in Settings, sample data loader.
*Done when:* I can create a food, log it, see totals vs. targets, and everything survives a page reload.

**Phase 2: Meals**
Meal builder, live totals, save/edit/delete, log a meal with a servings multiplier, snapshot behavior verified by tests.
*Done when:* I can build "Turkey sandwich" from three foods, log it, then edit an ingredient without changing the past entry.

**Phase 3: Fast re-add**
Favorites and Recents, search across My Foods and Meals, one-tap log.
*Done when:* logging a favorite food takes at most two taps from Today.

**Phase 4: USDA lookup**
`FoodProvider` interface, USDA provider, search UI, import into My Foods, error/rate-limit handling.
*Done when:* searching "turkey breast" returns usable results and importing one creates an editable food with correct macros.

**Phase 5: Polish and data safety**
JSON backup/import with schema version, CSV export, persist-storage prompt, PWA install, light/dark themes, accessibility pass, README and `DECISIONS.md`.
*Done when:* export, clear data, import restores everything; the **deployed** app installs to an iPhone home screen, works offline for local data, loads the correct icon and name, and shows the update prompt after a new deploy.

### After the POC (do NOT build now; keep the architecture ready)
1. **Barcode scanning:** camera via `getUserMedia` with a WebAssembly decoder (zxing-wasm) because native browser support is inconsistent on iOS Safari. Lookup chain: Open Food Facts (custom User-Agent, per-user rate limits, cache every hit, attribute under ODbL) then USDA branded by UPC, then manual entry. Show the matched product for confirmation, flag calorie/macro mismatches, and save corrections as custom foods. Validate against about 20 products the owner actually eats and track the hit rate.
2. Open Food Facts text search provider.
3. Optional sync/accounts and a thin API proxy for keys.
4. Weight log and simple trend chart.
5. **iOS:** decide between wrapping the web app (Capacitor) or a native SwiftUI rebuild using Apple's built-in barcode scanner. The `domain/` and data model should port directly.

## 9. How to work
- Plan briefly, then build phase by phase. Keep commits small and meaningful.
- Prefer boring, well-supported solutions over clever ones.
- Keep a running `DECISIONS.md` (decision, reason, alternatives).
- At the end of each phase, summarize what works, what's untested, and anything you'd change.
- Do not add features outside Section 2 without asking.
