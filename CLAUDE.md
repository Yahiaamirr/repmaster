# RepMaster — Project Context for Claude

## What it is
A competition management platform for calisthenics/strength tournaments.
Replaces a Google Sheets + Apps Script workflow with a real-time Next.js app backed by Supabase.

## Repo
https://github.com/Yahiaamirr/repmaster

## Stack
- Next.js 15 (App Router) — read node_modules/next/dist/docs/ before touching routing or server components
- Supabase (Postgres + Realtime + Auth) — project ref: xjbsucgzvbrbpchcduxe (West EU)
- TypeScript, Tailwind CSS, @supabase/ssr for auth/cookies

## Getting started
1. npm install
2. cp .env.example .env.local  — fill in Supabase URL + anon key + service_role key
   (get from the team lead OR create your own free Supabase project)
3. If using your own Supabase project: paste supabase/migrations/001_initial.sql
   into the SQL Editor and run it
4. npm run dev → http://localhost:3000
5. Admin login at /admin/login (team lead provides credentials, or create a user
   via Supabase dashboard → Auth → Users)

## Routes
/                               Landing page
/admin/login                    Auth gate — email + password
/admin/tournaments              List all tournaments
/admin/tournaments/new          Create tournament (lifts, categories, flight size, judges)
/admin/tournaments/[id]         Tournament overview + public link + QR code
/admin/tournaments/[id]/athletes  Add athletes, set openers per lift
/admin/tournaments/[id]/flights   Generate flights (ported Google Script algorithm)
/admin/tournaments/[id]/control   Live control room — set on platform, score attempts
/leaderboard/[id]               Public live leaderboard — Supabase Realtime WebSocket
/judge/[token]                  Judge tablet UI — full-screen Good Rep / No Rep

## Key files
lib/supabase/client.ts          Browser Supabase client (uses anon key + session cookie)
lib/supabase/server.ts          Server Supabase client (for Server Components / API routes)
lib/flight-generator.ts         Flight generation algorithm (ported from Google Apps Script)
middleware.ts                   Protects all /admin/* routes — redirects to /admin/login if no session
types/database.ts               TypeScript types for all DB tables
supabase/migrations/001_initial.sql  Full schema — 13 tables, 2 views, RLS, Realtime

## Database schema (tables)
organizations, tournaments, event_types (lifts), categories (weight classes),
athletes, athlete_openers, flights, flight_athletes, attempts, scores,
platform_state, judge_tokens

Views: athlete_event_maxes, leaderboard

## Auth model
- /admin/* requires Supabase Auth session (email + password)
- /leaderboard/[id] and /judge/[token] are fully public (no login)
- RLS: public read on all tables; authenticated write on all tables
- Judge access is token-based (judge_tokens table), no full auth account needed

## Current state
Everything is built and working end-to-end. Supabase project is live.
The main thing contributors are likely working on is features/UI on top of
this foundation — not infrastructure.

## Important notes
- This Next.js version may differ from training data — check node_modules/next/dist/docs/
- Do NOT commit .env.local (it's gitignored) — never put real keys in code
- The supabase/config.toml links the local CLI to the live project (ref xjbsucgzvbrbpchcduxe)
- DB password is held by team lead only — contributors don't need it for normal dev