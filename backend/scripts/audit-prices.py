"""Compare seed catalog prices to PDF text extracts (best-effort)."""
from __future__ import annotations

import json
import re
from pathlib import Path

EXT = Path(r"C:/Users/ghadi.mdallal/Downloads/attachments/extracted")
SEED = Path(r"C:/myProjects/darines-catering-quotes/backend/prisma/seed-data")


def dollars_to_cents(s: str) -> int:
    return int(round(float(s) * 100))


def parse_extract_prices(text: str) -> list[tuple[str, int]]:
    """Find 'Name .... N$' or 'Name N$' patterns."""
    found: list[tuple[str, int]] = []
    # dotted leaders: Name.....12$
    for m in re.finditer(
        r"([A-Za-z][A-Za-z0-9 &'/\-.,()+%]{2,80}?)\s*\.{2,}\s*(\d+(?:\.\d+)?)\s*\$",
        text,
    ):
        name = re.sub(r"\s+", " ", m.group(1)).strip(" •-")
        found.append((name, dollars_to_cents(m.group(2))))
    # trailing: Name (24 pcs) 32$
    for m in re.finditer(
        r"([A-Za-z][A-Za-z0-9 &'/\-.,()+%]{2,60}?)\s*(?:\([^)]*\))?\s+(\d+(?:\.\d+)?)\s*\$",
        text,
    ):
        name = re.sub(r"\s+", " ", m.group(1)).strip(" •-")
        if "....." in name:
            continue
        found.append((name, dollars_to_cents(m.group(2))))
    return found


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def seed_items(path: Path) -> list[tuple[str, str, int]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[tuple[str, str, int]] = []
    for cat in data.get("categories", []):
        for item in cat.get("items", []):
            for v in item.get("variants", []):
                label = v.get("label", "")
                out.append((item["name"], label, v["unitPriceCents"]))
        for sub in cat.get("subcategories", []):
            for item in sub.get("items", []):
                for v in item.get("variants", []):
                    label = v.get("label", "")
                    out.append((item["name"], label, v["unitPriceCents"]))
    for pkg in data.get("packages", []):
        out.append((pkg["name"], "BOX", pkg["unitPriceCents"]))
    return out


def match_price(name: str, extract: list[tuple[str, int]]) -> list[int]:
    n = norm(name)
    prices = []
    for ename, cents in extract:
        en = norm(ename)
        if n == en or n in en or en in n:
            prices.append(cents)
    return prices


def audit(seed_file: str, extract_file: str) -> None:
    extract = parse_extract_prices((EXT / extract_file).read_text(encoding="utf-8", errors="replace"))
    items = seed_items(SEED / seed_file)
    print(f"\n===== {seed_file} vs {extract_file} =====")
    mismatches = 0
    ambiguous = 0
    for name, label, cents in items:
        prices = match_price(name, extract)
        uniq = sorted(set(prices))
        if not uniq:
            continue
        if cents in uniq:
            continue
        if len(uniq) == 1:
            print(f"MISMATCH  {name} [{label}] seed=${cents/100:.2f} extract=${uniq[0]/100:.2f}")
            mismatches += 1
        else:
            print(f"AMBIGUOUS {name} [{label}] seed=${cents/100:.2f} extract={ [p/100 for p in uniq] }")
            ambiguous += 1
    print(f"-> mismatches={mismatches} ambiguous={ambiguous}")


if __name__ == "__main__":
    audit("catalog-catering.json", "Catering menu 2025-2026.txt")
    audit("catalog-cocktail.json", "Cocktail menu 2025-2026 final.txt")
    audit("catalog-soiree-box.json", "Soiree box menu 2025-2026.txt")
    audit("catalog-birthday-box.json", "BIRTHDAY BOX MENU copy.txt")
    print("\nKids extract length:", len((EXT / "Darine's - Kids Menu 2025 final.txt").read_text(encoding="utf-8", errors="replace")))
