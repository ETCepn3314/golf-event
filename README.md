# ⛳ Golf Event

A mobile-first web app for running golf outings: the organizer sets up the event (course, format, teams, entry fee, payouts), each foursome enters scores hole-by-hole from their phones, and everyone watches a **live leaderboard with money distribution**.

- **Formats**: Scramble, Stroke play, Best ball / Net (with handicaps), Stableford
- **Money**: place payouts from the entry-fee pot (percentage or fixed, with automatic tie-splitting) plus side contests (closest to pin, longest drive…)
- **No accounts**: organizer gets a 6-digit PIN; each team gets a private scoring link; the leaderboard link is public
- **Course-proof**: scores queue locally when signal drops and sync automatically when it returns

## One-time setup

### 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project (free tier is plenty).
2. In the dashboard open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Open **Project Settings → API** and copy two values:
   - **Project URL**
   - **`service_role` secret key** (not the anon key)

### 2. Configure the app

```bash
cp .env.example .env.local
# then edit .env.local with your Project URL and service_role key
```

### 3. Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # scoring engine unit tests
node scripts/seed-demo.mjs             # optional: seed a demo event (dev server must be running)
node scripts/api-smoke.mjs             # optional: API smoke test (dev server must be running)
```

## Deploying (Vercel, free)

1. Push this repo to GitHub.
2. In [vercel.com](https://vercel.com), **Import Project** from the repo.
3. Add the two environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) in the Vercel project settings.
4. Deploy. Your event links will be `https://your-app.vercel.app/e/...`.

## Day-of-event run book

- **The day before**: open your Supabase dashboard once. Free-tier projects pause after ~7 idle days; opening the dashboard unpauses in about a minute.
- Create the event at `/new`. **Save the organizer PIN when it's shown — it's only displayed once** (it's also remembered in that browser).
- Text each team their scoring link from the share screen; post the leaderboard link in the group chat.
- During the round, one player per foursome enters scores after each hole. If they lose signal, the app shows "Offline — will retry" and syncs automatically.
- Fix any mistakes from the **organizer dashboard** (`/e/<event>/admin`): tap a team, edit any hole, tap away to save.
- Enter side-contest winners in the dashboard as they're decided.
- After the round: review the leaderboard, then press **Finalize**. Scoring locks and the money page flips from "projected" to official.

## Trust model (worth knowing)

Anyone with a team's link can edit that team's scores, same as a paper scorecard handed to a foursome. The public leaderboard link is read-only. Only the PIN holder can correct other teams, manage contests, or finalize.

## Development notes

- **Scoring engine** (`src/lib/scoring/`) is pure TypeScript with no framework dependencies — all formats, handicaps, ranking, and payout tie-splitting are unit-tested (`npm test`). Derived values are never stored; everything is recomputed from raw strokes, so corrections are always safe.
- **API routes** (`src/app/api/`) do all database access server-side with the service-role key; RLS is enabled deny-all as a safety net.
- **Leaderboard polling**: clients poll every 10s; the endpoint is CDN-cacheable (`s-maxage=5`), so even a big field is a trivial load.
- **OneDrive tip**: if this folder lives in OneDrive, exclude `node_modules` from sync (or mark the repo "Always keep on this device") — it makes installs much faster.

## Manual test checklist

See [`docs/e2e-checklist.md`](docs/e2e-checklist.md) for the full dress-rehearsal script to run before your event.
