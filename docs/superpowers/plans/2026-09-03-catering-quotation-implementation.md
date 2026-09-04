# Darine's Catering Quotation System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production-ready catering quotation app with fixed seeded menu, backend calculation engines, quotation CRUD/PDF matching Aya sample, auth, clients, and dashboard.

**Architecture:** pnpm monorepo (`backend/` Express+Prisma+Postgres, `frontend/` React+Vite). Menu is read-only seeded data. Calculations run only on backend via `/api/quotations/calculate`. PDF via Puppeteer HTML template.

**Tech Stack:** Node 20+, TypeScript, Express, Prisma, PostgreSQL, Vitest, React 18, Vite, React Router, JWT/bcrypt, Puppeteer, decimal-safe integer cents.

## Global Constraints

- Menu is fixed: no menu management UI; no menu write APIs
- Do not hardcode menu items in React; load from API
- Money in integer cents (USD)
- Quotation lines store price/name snapshots
- Modes: PACKAGE | A_LA_CARTE | GUEST_BASED (mixable)
- PDF layout matches Catering Order Aya sample
- Seed data lives in `backend/prisma/seed-data/*.json` (already drafted)
- Project root: `C:/myProjects/darines-catering-quotes`
- No commits to unrelated repos; init git in this project only when committing

---

## File map

```text
darines-catering-quotes/
  package.json                 # pnpm workspace
  docker-compose.yml           # postgres
  backend/
    package.json
    prisma/schema.prisma
    prisma/seed.ts
    prisma/seed-data/*.json    # EXISTS
    src/app.ts
    src/server.ts
    src/config/env.ts
    src/lib/prisma.ts
    src/lib/money.ts
    src/middleware/auth.ts
    src/modules/auth/*
    src/modules/clients/*
    src/modules/menu/*
    src/modules/quotations/*
    src/modules/dashboard/*
    src/services/calculations/*
    src/services/pdf/*
    src/services/calculations/*.test.ts
  frontend/
    package.json
    src/main.tsx
    src/App.tsx
    src/api/*
    src/pages/*
    src/components/*
```

---

### Task 1: Monorepo scaffold + Postgres + Prisma schema

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `docker-compose.yml`, `.env.example`, `backend/*`, `frontend/*` (Vite scaffold)
- Create: `backend/prisma/schema.prisma`

- [ ] **Step 1:** Create workspace root + docker-compose Postgres on `5433` (avoid clash with other local DBs)
- [ ] **Step 2:** Scaffold backend TypeScript (Express) and frontend Vite React-TS
- [ ] **Step 3:** Write Prisma schema for User, Client, Menu*, QuantityRule, Quotation* per design spec
- [ ] **Step 4:** `docker compose up -d` + `pnpm --filter backend prisma migrate dev --name init`
- [ ] **Step 5:** Verify migrate succeeds

---

### Task 2: Calculation engine + tests (TDD)

**Files:**
- Create: `backend/src/services/calculations/quantity-calculation.service.ts`
- Create: `backend/src/services/calculations/pricing-calculation.service.ts`
- Create: `backend/src/services/calculations/quotation-calculation.service.ts`
- Create: `backend/src/lib/money.ts`
- Test: `backend/src/services/calculations/*.test.ts`

- [ ] **Step 1:** Write failing tests for:
  - 100 guests × 3 varieties × 9 pcs/guest distributed → 300 each
  - per-guest-per-variety
  - round up to 25
  - minimum quantity 100
  - package qty × price
  - discount + delivery + tax
- [ ] **Step 2:** Implement money helpers (`dollarsToCents`, `centsToDollars`, `mulQtyPrice`)
- [ ] **Step 3:** Implement quantity/pricing/quotation services until tests pass
- [ ] **Step 4:** Run `pnpm --filter backend test`

---

### Task 3: Idempotent menu seed

**Files:**
- Create: `backend/prisma/seed.ts`
- Use: `backend/prisma/seed-data/*.json`

- [ ] **Step 1:** Implement upsert-by-slug seed for catalogs/items/variants/packages
- [ ] **Step 2:** Seed default users: `ops@darines.local` / `admin@darines.local` (password from env)
- [ ] **Step 3:** Run seed twice; confirm idempotent
- [ ] **Step 4:** Spot-check counts (~91 catering items, ~134 cocktail, ~25 soiree packages)

---

### Task 4: Auth + Clients + read-only Menu APIs

**Files:**
- Create: `backend/src/modules/auth/*`, `clients/*`, `menu/*`, middleware

- [ ] **Step 1:** `POST /api/auth/login`, `GET /api/auth/me`, JWT middleware
- [ ] **Step 2:** Clients CRUD
- [ ] **Step 3:** `GET /api/menu`, `GET /api/menu/catalogs/:code` (read-only)
- [ ] **Step 4:** Confirm no menu write routes registered

---

### Task 5: Quotations API + calculate + statuses + duplicate

**Files:**
- Create: `backend/src/modules/quotations/*`

- [ ] **Step 1:** `POST /api/quotations/calculate`
- [ ] **Step 2:** CRUD quotations with line snapshots + components + charges
- [ ] **Step 3:** Status transitions + duplicate
- [ ] **Step 4:** Manual curl/integration check of Aya-like payload totals ≈ 34600 cents (noting Lebanese box sample price override)

---

### Task 6: PDF service (Aya layout)

**Files:**
- Create: `backend/src/services/pdf/catering-order-template.ts`, `pdf.service.ts`
- Route: `GET /api/quotations/:id/pdf`

- [ ] **Step 1:** HTML template: logo placeholder, fields, 5-col table, note bullets, totals
- [ ] **Step 2:** Puppeteer PDF download
- [ ] **Step 3:** Compare visually to Aya sample pages

---

### Task 7: Dashboard API

**Files:**
- Create: `backend/src/modules/dashboard/*`

- [ ] **Step 1:** Aggregates by status, total value, upcoming events, filters

---

### Task 8: Frontend shell + auth + clients + dashboard

**Files:**
- Create: frontend pages/components/api client

- [ ] **Step 1:** Login + protected routes
- [ ] **Step 2:** Dashboard cards
- [ ] **Step 3:** Clients list/form

---

### Task 9: Quotation builder UI (3-panel) + list + preview

**Files:**
- Create: `frontend/src/pages/Quotations/*`

- [ ] **Step 1:** List with status actions
- [ ] **Step 2:** Builder: left menu / center lines / right summary; call calculate on change
- [ ] **Step 3:** Preview + download PDF / print

---

### Task 10: README + end-to-end verification

- [ ] **Step 1:** README with setup (docker, migrate, seed, dev)
- [ ] **Step 2:** Create quotation mirroring Aya lines; verify PDF + totals
- [ ] **Step 3:** Confirm no menu management UI routes exist
- [ ] **Step 4:** Run backend tests green

---

## Execution note

Prefer executing tasks inline in order 1→10. After Task 2, calculation correctness is the riskiest gate — do not proceed to PDF/UI until calc tests pass.
