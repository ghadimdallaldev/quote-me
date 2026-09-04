# quote-me

Catering quotation app (PWA). Simple JWT login — **no Keycloak**.

## Stack

- Express + Prisma + PostgreSQL
- React + Vite PWA
- Single Railway service serves API + frontend

## Local

```bash
docker compose up -d
pnpm install
cp .env.example backend/.env
cd backend && pnpm exec prisma migrate deploy && pnpm exec tsx prisma/seed.ts && cd ..
pnpm --filter @quote-me/backend dev
pnpm --filter @quote-me/frontend dev
```

Login: `ops@darines.local` / `ChangeMe123!`

## Railway (cheap)

1. One **Web** service + one **Postgres** plugin (no Keycloak / Redis / Chromium).
2. Env: `DATABASE_URL` (from Postgres), `JWT_SECRET` (long random), optional `COMPANY_*`.
3. Leave `VITE_API_URL` empty (same-origin `/api`).
4. Build: `pnpm install && pnpm build`
5. Start: migrate + seed (idempotent) + start

```bash
pnpm --filter @quote-me/backend exec prisma migrate deploy && pnpm --filter @quote-me/backend prisma:seed && pnpm start
```
