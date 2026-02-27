# Techstack Template 1

Reusable Next.js + Neon + Drizzle starter stack.

## Quick start

1. Copy `env.example` to `.env.local` and fill in values.
2. Install deps with `npm install`.
3. Run the dev server: `npm run dev`.

## Database

- Generate migrations: `npm run db:generate`
- Push schema: `npm run db:push`
- Open Drizzle Studio: `npm run db:studio`

## Auth

The default setup uses Credentials (email + password) with JWT sessions.
Create users via `POST /api/auth/register`.

## Tests

Run `npm run test` for Vitest.
