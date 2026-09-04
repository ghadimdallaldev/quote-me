# Darine's Catering Quotation System — Design Spec

**Date:** 2026-09-03  
**Status:** Draft pending user approval  
**Project path:** `C:/myProjects/darines-catering-quotes`

---

## 1. Goal

Build a production-ready internal web app for Darine's Catering (Operations Manager workflow) that:

1. Exposes a **fixed, seeded menu** (no menu management UI).
2. Creates client quotations quickly from that menu.
3. Calculates quantities and prices on the **backend**.
4. Generates a professional PDF matching the provided **Catering Order** sample (Aya, 16/8).

---

## 2. Source documents analyzed

| Document | Use in system |
|----------|----------------|
| Catering menu 2025-2026.pdf | Seed catalog `CATERING` |
| Cocktail menu 2025-2026 final.pdf | Seed catalog `COCKTAIL` |
| Soiree box menu 2025-2026.pdf | Seed catalog `SOIREE_BOX` (packages) |
| BIRTHDAY BOX MENU copy.pdf | Seed catalog `BIRTHDAY_BOX` |
| Darine's - Kids Menu 2025 final.pdf | Seed catalog `KIDS` |
| Catering Order Aya 16 august.pdf | PDF / quotation layout template |

**Brand facts (from docs):**

- Trading names: Darine's Catering / Cooking Dairy
- Location: Beirut, Badaro (next to Sweet Industry & AUCE)
- Currency: USD (`$`)
- Instagram: @DarinesCatering

---

## 3. Architecture decision

**Approach:** pnpm monorepo with separate `backend/` and `frontend/`.

| Layer | Choice |
|-------|--------|
| Backend | Node.js, Express, TypeScript |
| ORM / DB | Prisma + PostgreSQL |
| Frontend | React, Vite, TypeScript, modern component library |
| Auth | JWT; roles `ADMIN`, `OPS_MANAGER` |
| PDF | HTML template (Aya layout) rendered with Puppeteer |
| Money | Integer **cents** only |
| Menu delivery | Seeded DB → read-only REST → frontend (never hardcoded in React) |

**Explicit non-goals:**

- No Menu Management page
- No add/edit/delete menu item/category APIs for the app
- Menu changes only via developer seed/migration updates

---

## 4. Quotation modes (approved direction: both)

A quotation may mix line types (as in the Aya sample: boxes + dozens).

| Mode | Operator action | Engine behavior |
|------|-----------------|-----------------|
| `PACKAGE` | Select box/package; optional variety customization in Note | `qty × package unit price`; snapshot components into Note |
| `A_LA_CARTE` | Select item/variant; enter or default quantity | Apply minimum + rounding; `qty × unit price` |
| `GUEST_BASED` | Enter guest count; select varieties | Apply seeded quantity rule (per-guest or distributed); then price |

**Guest-based rules:** engine supports both methods from the original brief. Rules are seeded only where business data confirms them. Categories without confirmed guest rules expose package/a la carte only until rules are provided.

---

## 5. Database schema

### 5.1 Auth & CRM

```text
User
  id, name, email, passwordHash, role(ADMIN|OPS_MANAGER), createdAt, updatedAt

Client
  id, name, company?, phone?, email?, address?, notes?, createdAt, updatedAt
```

### 5.2 Fixed menu

```text
MenuCatalog
  id, code(CATERING|COCKTAIL|SOIREE_BOX|BIRTHDAY_BOX|KIDS), name, displayOrder

MenuCategory
  id, catalogId, name, displayOrder, notes?, defaultCalcMethod?

MenuSubcategory
  id, categoryId, name, displayOrder

MenuItem
  id, categoryId, subcategoryId?, name, description?, servingInfo?, displayOrder, isActive

MenuItemVariant
  id, menuItemId
  label                 -- e.g. "Soiree 3cm", "Normal 5-8cm", "Dozen", "28cm"
  unit                  -- BOX|DOZEN|PORTION|PIECE|KG|CAKE|SHOT|JAR|PERSON
  unitPriceCents
  minimumQuantity?
  roundingIncrement?    -- round UP to nearest N
  piecesPerUnit?
  displayOrder

MenuPackage
  id, catalogId, categoryId?, name
  unitPriceCents, unit(BOX|PERSON), totalPieces?, displayOrder, notes?

MenuPackageComponent
  id, packageId, name, quantity?, unit?, sortOrder, isCustomizable
```

### 5.3 Quantity rules (seeded)

```text
QuantityRule
  id
  scope(CATEGORY|ITEM|VARIANT|PACKAGE)
  scopeId
  method(PER_GUEST_PER_VARIETY|DISTRIBUTED_ACROSS_VARIETIES|FIXED_UNIT|PACKAGE)
  quantityPerGuest?
  totalPiecesPerGuest?
  roundingIncrement?
  minimumQuantity?
  notes?
```

### 5.4 Quotations

```text
Quotation
  id, quotationNumber
  clientId?, createdById
  customerName, company?, phone?, email?
  eventDate?, eventTime?, eventLocation?
  guestCount?, waiterCount?, eventType?, notes?
  status(DRAFT|SENT|PENDING|APPROVED|REJECTED|EXPIRED|CONFIRMED)
  subtotalCents, discountCents, chargesCents, taxCents, grandTotalCents
  validUntil?, terms?, paymentTerms?
  createdAt, updatedAt

QuotationItem                 -- one PDF table row
  id, quotationId, lineNumber
  lineMode(PACKAGE|A_LA_CARTE|GUEST_BASED)
  menuItemId?, menuVariantId?, menuPackageId?
  unitSnapshot, orderNameSnapshot, categorySnapshot?
  quantity, unitPriceCents, lineTotalCents
  noteSnapshot
  wasAutoCalculated, calcExplanation?
  sortOrder

QuotationItemComponent        -- Note bullets
  id, quotationItemId, name, quantity?, unit?, sortOrder

QuotationCharge
  id, quotationId, name
  type(FIXED|PERCENT|DELIVERY|SETUP|SERVICE|TAX|CUSTOM)
  value, amountCents, sortOrder
```

**Integrity rules:**

- Quotation lines store **snapshots** so historical PDFs stay correct if seed prices later change.
- Menu tables have no application write endpoints.
- All monetary math uses integer cents.

### 5.5 Aya sample mapping

| PDF | Model |
|-----|--------|
| Customer Name / Phone / Address / Date / attendees / waiters | `Quotation` fields |
| Lebanese box, 1 Box, 35, Note bullets | `QuotationItem` PACKAGE + components |
| 5 Dozen Sweets, 148, Note with dozen breakdown | `QuotationItem` A_LA_CARTE (+ components) |
| Subtotal / Delivery / Total | totals + `QuotationCharge` DELIVERY |

---

## 6. Backend modules

```text
backend/
  prisma/schema.prisma
  prisma/seed.ts                 -- idempotent fixed menu + admin user
  src/
    modules/auth|clients|menu|quotations|dashboard
    services/calculations/
      quantity-calculation.service.ts
      pricing-calculation.service.ts
      quotation-calculation.service.ts
    services/pdf/
      catering-order-template.ts
      pdf.service.ts
```

### 6.1 Calculate API

`POST /api/quotations/calculate`

**Request (conceptual):**

```json
{
  "guestCount": 100,
  "lines": [
    { "lineMode": "PACKAGE", "menuPackageId": "...", "quantity": 1 },
    { "lineMode": "A_LA_CARTE", "menuVariantId": "...", "quantity": 5 },
    { "lineMode": "GUEST_BASED", "menuVariantIds": ["...", "..."] }
  ],
  "charges": [
    { "type": "DELIVERY", "name": "Delivery Charge", "value": 0 }
  ],
  "discount": { "type": "FIXED", "value": 0 },
  "tax": { "type": "PERCENT", "value": 0 }
}
```

**Response:** calculated lines (qty, unit price, totals, explanations), category totals, subtotal, charges, discount, tax, grand total.

Frontend displays results; backend remains source of truth.

### 6.2 Other APIs

```text
POST /api/auth/login
GET  /api/auth/me
GET  /api/dashboard
GET  /api/menu
GET  /api/menu/catalogs/:code
GET/POST /api/clients
GET/PUT  /api/clients/:id
GET/POST /api/quotations
GET/PUT  /api/quotations/:id
POST     /api/quotations/:id/duplicate
POST     /api/quotations/:id/status
GET      /api/quotations/:id/pdf
```

---

## 7. Frontend

```text
frontend/src/pages/
  Auth/Login
  Dashboard
  Clients
  Quotations/List
  Quotations/Builder   -- 3-panel speed UI
  Quotations/Preview
```

**Builder:**

- Left: catalogs → categories → items/packages; search; add/remove from quotation only
- Center: selected lines with auto-calc indicators
- Right: guests, live summary, charges/discounts, save / PDF

Removing a line never mutates the fixed menu.

---

## 8. PDF generation

Template mirrors **Catering Order Aya**:

1. Logo + title “Catering Order”
2. Customer fields (2-column)
3. Table: No. | Unit | Order | Unit Price | Note
4. Note column supports multi-line bullets / sub-groups
5. Subtotal, Delivery Charge, Total
6. Multi-page support, print, download

---

## 9. Seeding strategy

1. Parse/structure all five menu catalogs into seed data modules.
2. `prisma db seed` upserts by stable codes/slugs (idempotent).
3. Seed default ops user (credentials in `.env.example` only).
4. Seed known minimums from menus (e.g. salads min 6 portions; Mini Kakeeh min 2 dozen; some sweets min 2 dozen).
5. Seed Soiree/Birthday/Kids packages with components and piece counts from PDFs.
6. Do **not** invent guest×pieces multipliers without confirmation.

---

## 10. Testing

Automated tests for:

- Per-guest-per-variety quantity
- Distributed-across-varieties quantity
- Rounding up to increment
- Minimum quantity
- Package line pricing
- Discount / delivery / tax aggregation
- Cent-safe arithmetic (no float drift)
- Snapshot fields populated on save

---

## 11. Implementation phases

1. Monorepo scaffold + Prisma schema + Docker Postgres
2. Idempotent menu seed from structured data extracted from PDFs
3. Auth + clients + read-only menu API
4. Calculation engine + tests
5. Quotation CRUD + calculate endpoint
6. Builder UI + dashboard
7. PDF template matching Aya sample
8. End-to-end polish

---

## 12. Open questions (non-blocking for scaffold; blocking for guest rules)

1. Exact guest-based multipliers per cocktail/fingerfood category (if used).
2. Default VAT/tax rate (if any) for Lebanon operations.
3. Official logo file + preferred company legal name on PDF (“Darine's Catering” vs “Cooking Dairy”).
4. Default admin/ops login email to seed.

---

## 13. Approval

Please review this spec and reply:

- **approved** — proceed to implementation plan, then build
- **changes:** … — list edits

No application code beyond this design documentation should be treated as complete until calculation, seeding, APIs, UI, and PDF are implemented and verified against this objective.
