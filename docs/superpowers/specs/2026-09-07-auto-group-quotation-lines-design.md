# Auto-group quotation lines by category

**Date:** 2026-09-07  
**Status:** Approved  
**App:** quote-me (`darines-catering-quotes`)

## Goal

Match Darine’s Catering Order layout: **Order** = category only (e.g. Lebanese corner); **Note** = varieties with the quantities the user already chose; **No.** = sum of those quantities; **Unit Price column** = group line total.

## Decisions

- Approach **A**: collapse at calculate / display / PDF (not a separate “package” builder step).
- Quantities: user sets each variety qty; system only **sums** for the group row.
- Auto-group by `category` for `A_LA_CARTE` / `GUEST_BASED` lines.
- `PACKAGE` lines (Soiree boxes, etc.) stay one row each (unchanged).
- Persist **individual** lines in DB so edit still works; group for Selected order, quotation detail, and PDF.

## Display rules

| Column | Value |
|--------|--------|
| Order | `categorySnapshot` (e.g. `Lebanese Corner`) |
| Note | `• {item} ({qty} {unit})` per variety |
| No. | Σ qty |
| Unit Price (PDF) | group `lineTotal` (matches paper sample) |

## Out of scope

- Changing how guest-calc distributes pieces
- Renaming menu categories
- Mobile sibling repos (quote-me only)
