# Beat the Buffet — backend

TypeScript/Fastify API behind the **Beat the Buffet** iOS app, a native Swift/SwiftUI app for finding and tracking all-you-can-eat restaurants. This repo holds the backend; the iOS app lives in a separate (private) repo.

## What it does

- **Search** buffets near a location using Google Places, then run a two-stage classifier (`src/classifier.ts`) that uses name, place types, and review text to decide whether a place is genuinely all-you-can-eat.
- **Auth** with Firebase Auth / Sign in with Apple, verified server-side (`src/auth.ts`); per-user rate limiting via `@fastify/rate-limit`.
- **Persistence** in PostgreSQL (`src/db.ts`) with seed and migration scripts under `scripts/` (US buffet seed, aggregates, provenance, user data).
- **Notifications** route for push-notification inbox writes, with Firestore rules for notification and referral caps.
- **Scan** route that uses AI classification to turn unstructured restaurant information into structured data.

## Stack

Fastify 4 · TypeScript · PostgreSQL (`postgres`) · Firebase Admin · Zod · `@fastify/jwt` · `@fastify/rate-limit` · deployed on Railway

## Run locally

```bash
cd backend
npm install
cp .env.example .env   # DATABASE_URL, Firebase service account, Google Places key
npm run dev            # tsx watch src/index.ts, serves on :4000
curl localhost:4000/health
```

## Layout

```
backend/src/index.ts      Fastify bootstrap, CORS, rate limit, route registration
backend/src/routes/       search, places, scan, notify
backend/src/classifier.ts keyword + review heuristics for AYCE detection
backend/src/auth.ts       Firebase token verification
backend/src/db.ts         Postgres client
backend/scripts/          seeding and data-maintenance scripts
firestore.rules           Firestore security rules
```
