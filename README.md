# FitTrack

[![Build and Deploy](https://github.com/astordahl3-cmd/FitTrack/actions/workflows/build-and-deploy.yml/badge.svg?branch=source)](https://github.com/astordahl3-cmd/FitTrack/actions/workflows/build-and-deploy.yml)
[![GitHub Pages](https://github.com/astordahl3-cmd/FitTrack/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/astordahl3-cmd/FitTrack/actions/workflows/pages.yml)

A personal fitness tracking Progressive Web App (PWA) built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui, and Supabase.

**Live app:** https://astordahl3-cmd.github.io/FitTrack/

---

## Features

### Dashboard
- Daily date header with **Log Food** quick-action button
- **Goal progress bar** — tracks current weight vs. start/goal weight
- **Macro rings** — visual rings for calories, protein, carbs, and fat vs. daily targets
- Calories remaining / protein to go summary cards
- Stat cards: today's weight, meals logged, workouts, protein total
- Today's meals list
- Quick-action buttons: Log Food, Log Workout, Log Weight

### Food Log
- Date navigation (previous/next day)
- Meals grouped by time: Noon, 3 PM, 6 PM, 8 PM, Other
- **Food library search** with autocomplete
- **Category filter chips**: 🥤 Shakes & Supplements · 🥩 Proteins · 🥚 Eggs & Dairy · 🍎 Fruits · 🥦 Vegetables · Other
- **Barcode scanner** (native BarcodeDetector API + Quagga2 fallback) — looks up Open Food Facts
- Food library CRUD — add, edit, delete custom foods
- 37 foods auto-seeded on signup across all categories

### Workout Log
- Log workouts with type, duration, calories burned, exercises, notes
- Pre-built templates (Treadmill, Lifting, Sauna, Full Workout)
- Exercise list with sets/reps/weight tracking
- Workout history grouped by date with deltas

### Weight Tracker
- SVG line chart of weight history
- Dynamic milestones computed from your goal
- Weekly pace indicator
- History list with weight deltas between entries
- Goal driven by profile start/goal weight and goal date

### Profile
- Display name, sex, birthdate (auto-calculates age), height (ft + in), activity level
- Weight goal: start weight, goal weight, goal date
- **Mifflin-St Jeor TDEE calculator** — 5 deficit options (maintain / 0.5 / 1 / 1.5 / 2 lbs/week) with "Apply to targets" button
- **Percentage-based macro sliders** — protein/carb/fat linked to sum to 100%; grams auto-calculated from calorie target
- Summary table showing all current targets

### Food Library Auto-Save
- Any food logged from the Dashboard quick-log dialog is automatically saved to your personal food library if it doesn't already exist there

### Auth
- Email + password sign in / sign up / password reset
- Each user has their own private data (Row Level Security enforced)
- New accounts are auto-seeded with 37 food library items

### PWA
- Add to Home Screen on iOS and Android
- Manifest and service worker included

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS v3, shadcn/ui |
| Routing | Wouter (hash-based — required for static hosting) |
| Backend / DB | Supabase (Postgres + Auth + RLS) |
| Hosting | GitHub Pages (Actions-based deployment) |

---

## Project Structure

```
fittrack/
├── client/
│   ├── index.html                  # Base path: /FitTrack/ — do not change
│   ├── public/
│   │   ├── manifest.json           # PWA manifest (start_url: /FitTrack/)
│   │   ├── sw.js                   # Service worker (pass-through, no caching)
│   │   └── icon-192.png, icon-512.png, favicon.png
│   └── src/
│       ├── App.tsx                 # Auth guard + router
│       ├── index.css               # Dark slate + teal theme
│       ├── main.tsx                # Entry point + SW registration
│       ├── lib/
│       │   ├── supabase.ts         # Supabase client
│       │   └── storage.ts          # All Supabase CRUD functions
│       ├── components/
│       │   ├── Sidebar.tsx         # Navigation + live targets from profile
│       │   └── BarcodeScanner.tsx  # Barcode scanner component
│       └── pages/
│           ├── Auth.tsx            # Login / signup / reset
│           ├── Dashboard.tsx       # Main dashboard
│           ├── FoodLog.tsx         # Food logging + library
│           ├── WorkoutLog.tsx      # Workout logging
│           ├── WeightTracker.tsx   # Weight chart + history
│           └── Profile.tsx         # Biometrics + TDEE + macro calculator
├── .github/
│   ├── workflows/
│   │   └── pages.yml               # GitHub Actions Pages deployment
│   └── ISSUE_TEMPLATE/             # Bug report + feature request templates
├── vite.config.ts                  # base: "/FitTrack/" — CRITICAL, do not change
└── package.json
```

---

## Supabase Database

**Project URL:** `https://katpbbmhprximuxyjicf.supabase.co`

### Tables

| Table | Key Columns |
|---|---|
| `weight_entries` | id, user_id, date, weight, note |
| `food_entries` | id, user_id, date, meal, name, calories, protein, carbs, fat |
| `workout_sessions` | id, user_id, date, type, duration, calories_burned, exercises (JSONB), notes |
| `food_library` | id, user_id, name, calories, protein, carbs, fat, serving_size, category |
| `user_profiles` | id, display_name, start_weight, goal_weight, goal_date, calorie_target, protein_target, carb_target, fat_target, sex, height_in, age, birthdate, activity_level |

All tables have **Row Level Security (RLS)** — every query is automatically scoped to the authenticated user. All inserts must include `user_id: session.user.id`.

---

## Important Behaviors

### Hash Routing
The app uses **hash-based routing** (`wouter` with `useHashLocation`). All routes are prefixed with `#`:
- `/#/` — Dashboard
- `/#/food` — Food Log
- `/#/workout` — Workout Log
- `/#/weight` — Weight Tracker
- `/#/profile` — Profile

This is required for static hosting on GitHub Pages. **Do not switch to path-based routing** — it will break the deployed app.

### Vite Base Path
`vite.config.ts` has `base: "/FitTrack/"`. This must never be changed or all asset paths will break on GitHub Pages.

### Service Worker
The service worker (`sw.js`) is a pass-through — it does **no caching** and always fetches from the network. This prevents stale content issues across deployments. It is registered at `/FitTrack/sw.js` (not `/sw.js`).

### No localStorage
The app does **not use localStorage** for any app data. All data is persisted in Supabase. The Supabase auth client uses `localStorage` internally for session storage with the key `fittrack-auth`.

---

## Redeploy Instructions

### Prerequisites
- Node.js 18+
- GitHub repo access (`astordahl3-cmd/FitTrack`)
- Supabase project credentials (already in `client/src/lib/supabase.ts`)

### 1. Install dependencies
```bash
cd fittrack
npm install
```

### 2. Run locally
```bash
npm run dev
# Opens at http://localhost:5173
```

### 3. Build
```bash
npm run build
# Output goes to dist/public/
```

### 4. Copy PWA assets (always after build)
```bash
cp client/public/{manifest.json,sw.js,icon-192.png,icon-512.png,favicon.png} dist/public/
cp dist/public/index.html dist/public/404.html
touch dist/public/.nojekyll
mkdir -p dist/public/.github/workflows
cp .github/workflows/pages.yml dist/public/.github/workflows/pages.yml
```

### 5. Deploy to GitHub Pages
```bash
cd dist/public
git init && git checkout -b main
git config user.email "fittrack@deploy.local"
git config user.name "FitTrack Deploy"
git remote add origin https://github.com/astordahl3-cmd/FitTrack.git
git add -A
git commit -m "deploy: <your message>"
git push --force origin main
```
GitHub Actions will automatically pick up the push and deploy to Pages within ~30 seconds.

### 6. Push source code backup
```bash
cd /path/to/fittrack   # back to project root
git add -A
git commit -m "your message"
git push origin source                  # FitTrack repo, source branch
git push backup source:main             # FitTrack-Source repo, main branch
```

> The `backup` remote points to `https://github.com/astordahl3-cmd/FitTrack-Source.git` and should already be configured in the local repo.

---

## Restore From Backup

To restore the source code from the `FitTrack-Source` repo:

```bash
git clone https://github.com/astordahl3-cmd/FitTrack-Source.git fittrack
cd fittrack
npm install
```

Then follow the **Build** and **Deploy** steps above.

---

## GitHub Issues

Feature requests and bugs are tracked in [FitTrack-Source Issues](https://github.com/astordahl3-cmd/FitTrack-Source/issues).

- [#1 — Apple Health export](https://github.com/astordahl3-cmd/FitTrack-Source/issues/1)
- [#2 — Cross-device sync](https://github.com/astordahl3-cmd/FitTrack-Source/issues/2)
