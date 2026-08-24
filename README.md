# OpenDinks

Cloud-first pickleball **open play OS** — fair court rotations, live queues, QR player views, and TV wallboards.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Auth, Postgres, RLS, Realtime)
- Pure TypeScript rotation engine in `src/engine/` (fully unit tested)

## Quick start (local demo, no Supabase)

```bash
yarn install
yarn dev
```

Open [http://localhost:3000/demo](http://localhost:3000/demo):

1. **Seed 12 players**
2. **Fill open courts**
3. Open `/demo/player` and `/demo/board` in other tabs (same browser — localStorage sync)

## Supabase setup

1. Create a Supabase project
2. Copy `.env.example` → `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000`)
3. Run the SQL in [`supabase/migrations`](supabase/migrations) in the Supabase SQL editor (or `supabase db push`)
4. Facility branding is per account: creating a venue creates a facility for that host. Edit name/tagline on the venue page; wallboard and player views load it from the venue.
5. In Auth → URL configuration, add `{SITE_URL}/auth/callback`
6. `yarn dev` → `/login` → magic link → create a venue → start open play

## Scripts

```bash
yarn test          # rotation engine
yarn type-check
yarn lint
yarn format:check
yarn build
```

## Product scope (v1)

**In:** venues, live sessions, check-in, fair rotation modes, host console, player QR view, wallboard, partner locks, session summary  
**Out:** bookings, memberships, payments, DUPR export, native apps
