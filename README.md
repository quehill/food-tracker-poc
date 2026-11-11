# Macro Tracker (POC)

A minimal, fast, local-only macro tracker. Mobile-first installable PWA; built so the core can later move to iOS.

No accounts, no ads, no sync. Data lives in your browser (IndexedDB).

## Features

- **Today:** daily calories/protein (and optional carbs/fat) vs. targets, entries by day, edit servings, delete.
- **Add:** Favorites, Recent, and search across foods and meals; "+1" logs one serving in one tap (with Undo). A favorite is two taps from Today.
- **Foods:** custom foods per serving, optional serving grams (enter quantities by grams), calorie sanity warning. Changing serving grams rescales the macros automatically (toggleable).
- **Meals:** build from foods with live totals; log with a servings multiplier. Log entries snapshot their values, so editing foods/meals never changes history.
- **USDA lookup:** search FoodData Central (generic results first) and import into My Foods.
- **Settings:** targets, JSON backup export/import, CSV export of the log, clear data, persistent-storage status, last-backup reminder.

## Data safety

- **Backup:** Settings > Export JSON backup. The file is versioned (`schemaVersion`) and validated on import; importing **replaces** all data on the device after a confirmation. On phones the file is handed to the share sheet (choose "Save to Files").
- **CSV:** Settings > Export log as CSV (one row per entry; opens in Excel/Numbers/Sheets).
- **Storage persistence:** the app asks the browser for persistent storage on launch; Settings shows the result. iOS may still clear data for sites that aren't installed, so install the app and export backups regularly (Settings reminds you after 7 days).

## Setup

Requires Node 22+ (see `.nvmrc`).

```sh
npm install
cp .env.example .env.local   # optional; add VITE_USDA_API_KEY for food lookup
npm run dev
```

### Environment variables

| Variable            | Purpose                                                               |
| ------------------- | --------------------------------------------------------------------- |
| `VITE_USDA_API_KEY` | USDA FoodData Central key. Optional; lookup is disabled when missing. |
| `VITE_BASE_PATH`    | Path the app is served from. `/` locally; `/<repo>/` on GitHub Pages. |

Get a free USDA key at https://fdc.nal.usda.gov/api-key-signup (1,000 requests/hour). `DEMO_KEY` works for light local testing.

**Security note:** any `VITE_*` variable is compiled into the public JavaScript bundle, so the USDA key is visible to anyone using the site. That is acceptable for a free key on a personal POC. Before any wider release, put a thin proxy in front of the API. Never commit a real key; only `.env.example` is committed.

### Scripts

| Script            | What it does                            |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Dev server at http://localhost:5173/    |
| `npm run build`   | Production build to `dist/`             |
| `npm run preview` | Serve the production build locally      |
| `npm run check`   | Lint + typecheck + unit tests (CI gate) |
| `npm test`        | Vitest in watch mode                    |
| `npm run format`  | Prettier                                |
| `npm run icons`   | Regenerate placeholder PWA icons        |

To preview the Pages build locally: `VITE_BASE_PATH=/food-tracker-poc/ npm run build && npm run preview`, then open `http://localhost:4173/food-tracker-poc/`.

## Architecture

```
src/
  domain/     Pure TypeScript: types, macro math, validation, dates. No browser/React imports (lint-enforced).
  data/       Repository interfaces + Dexie (IndexedDB) implementation.
  providers/  Food lookup providers behind one FoodProvider interface (USDA now; Open Food Facts/barcode later).
  ui/         React components and screens.
  app/        Routing and wiring.
```

- All macro calculations live in `domain/` and are unit tested.
- The UI talks to repositories (`src/app/repos.ts`), never to Dexie directly.
- Log entries snapshot name and macros at log time; editing a food never rewrites history.
- Hash routing (`#/foods`) so GitHub Pages never 404s on deep links or refresh.

See `DECISIONS.md` for choices and trade-offs.

## Deploying to GitHub Pages

The workflow at `.github/workflows/deploy.yml` runs `npm run check` and `npm run build` on every push and pull request, and deploys to Pages only on pushes to `main`.

**One-time owner setup:**

1. Repository **Settings > Pages > Build and deployment > Source: GitHub Actions**.
2. **Settings > Secrets and variables > Actions > New repository secret**: name `VITE_USDA_API_KEY`, value = your USDA key. (The build still succeeds without it; lookup is just disabled.)
3. GitHub Pages on a **private** repository requires a paid plan. On a free account, make the repository public.

After that, push to `main`. The app is published at `https://<user>.github.io/<repo>/` (for this repo: `https://quehill.github.io/food-tracker-poc/`).

The base path is set automatically in CI from the repository name. If the site shows a blank page or 404s on assets, the base path is wrong.

### Updates

The service worker caches the app shell for offline use. When a new version is deployed, the app shows **"Update available, tap to refresh"**. It checks for updates on launch, when the app returns to the foreground, and hourly.

## Testing on iPhone

1. Open the Pages URL in **Safari**.
2. Tap **Share > Add to Home Screen**.
3. Launch from the home screen icon and test there.

The Safari tab and the installed app keep **separate storage** on iOS. Export a JSON backup before moving between them. iOS may also evict storage for sites that are not installed and not used for a while, so prefer the installed app and keep backups.
