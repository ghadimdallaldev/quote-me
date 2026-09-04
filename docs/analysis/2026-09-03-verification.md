# Darine's Catering Quotation — verification (2026-09-03)

## Requirement evidence

| Requirement | Evidence |
|-------------|----------|
| Fixed seeded menu (no management UI) | Seeded DB: 5 catalogs, 225 items, 30 packages. Grep: no `POST/PUT/DELETE /api/menu`. Frontend loads `/api/menu` only. |
| Auth Admin / Ops Manager | Login smoke: `ops@darines.local` → `OPS_MANAGER`. Seed creates both roles. |
| Clients | `GET/POST /api/clients`, Clients page in UI |
| Dashboard | `GET /api/dashboard` returns counts/value/upcoming |
| Quotation CRUD + statuses | create/update/get/list/duplicate/status routes; UI actions Sent/Approved/Confirmed |
| Backend calc engines | `quantity/pricing/quotation-calculation.service.ts` + 9 Vitest tests passing |
| Real-time calculate API | `POST /api/quotations/calculate` used by builder |
| PDF matching Aya sample | E2E script created Aya quotation; PDF text extract shows No/Unit/Order/Unit Price/Note, boxes, sweets 148$, Subtotal/Delivery/Total **346$** |
| Menu not hardcoded in React | `api.menu()` in builder; seed JSON only under `backend/prisma/seed-data` |
| Modes PACKAGE / A_LA_CARTE / GUEST_BASED | Calc engine + builder Guest calc button for fingerfood when guests > 0 |

## Known residual gaps (non-blocking / documented)

1. Exact company guest×pieces multipliers not provided — guest mode uses configurable rule default `DISTRIBUTED_ACROSS_VARIETIES` with `totalPiecesPerGuest: 9` (from original brief example); update via seed `QuantityRule` when business confirms.
2. Kids menu image-only pages beyond Options 1–3 / Parents Menu may be incomplete — extend seed after full OCR/review.
3. Cocktail drink Large column OCR ambiguous — seeded from text extract best-effort.
4. Official logo file not provided — PDF uses lettermark “D” placeholder.
5. Puppeteer Chromium download skipped on Windows — PDFKit structured generator is primary (verified).

## Commands verified

- `pnpm --filter @darines/backend test` → 9/9 pass
- `pnpm --filter @darines/backend typecheck` → pass
- `node backend/scripts/e2e-aya.mjs` → grandTotalCents 34600 + valid PDF
