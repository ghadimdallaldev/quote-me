import { prisma } from "../../lib/prisma.js";

type NamedLine = {
  orderNameSnapshot: string;
  menuVariantId?: string | null;
  unitSnapshot?: string;
};

const GENERIC_LABELS = new Set([
  "dozen",
  "piece",
  "portion",
  "box",
  "person",
  "cake",
  "shot",
  "jar",
  "tower",
  "custom",
]);

/** Build display name: "Item (variety)" — category is stored separately. */
export function formatMenuOrderName(
  categoryName: string | null | undefined,
  itemName: string,
  variantLabel?: string | null,
): string {
  void categoryName; // category belongs in categorySnapshot / Order column when grouped
  const item = itemName.trim();
  const label = (variantLabel ?? "").trim();
  if (!label) return item;
  if (GENERIC_LABELS.has(label.toLowerCase())) return item;
  if (item.toLowerCase().includes(label.toLowerCase())) return item;
  if (item.toLowerCase() === label.toLowerCase()) return item;
  return `${item} (${label})`;
}

/** Ensure variety/label appears on quotation line display names (not category). */
export async function withVarietyInOrderNames<T extends NamedLine>(
  items: T[],
): Promise<T[]> {
  const ids = [
    ...new Set(
      items
        .map((i) => i.menuVariantId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return items;

  const variants = await prisma.menuItemVariant.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      label: true,
      unit: true,
      menuItem: {
        select: {
          name: true,
          category: { select: { name: true } },
        },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  return items.map((item) => {
    if (!item.menuVariantId) return item;
    const v = byId.get(item.menuVariantId);
    if (!v) return item;
    const preferred = formatMenuOrderName(
      v.menuItem.category.name,
      v.menuItem.name,
      v.label,
    );
    const current = item.orderNameSnapshot ?? "";
    if (current.toLowerCase().includes(v.menuItem.name.toLowerCase())) {
      // Already has item name; only upgrade if variety label is missing
      if (
        !v.label ||
        GENERIC_LABELS.has(v.label.toLowerCase()) ||
        current.toLowerCase().includes(v.label.toLowerCase())
      ) {
        return item;
      }
    }
    return {
      ...item,
      orderNameSnapshot: preferred || current,
    };
  });
}

export async function resolveLineOrderNames(
  lines: Array<{ orderName: string; menuVariantId?: string | null }>,
): Promise<string[]> {
  const ids = [
    ...new Set(
      lines
        .map((l) => l.menuVariantId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const variants = ids.length
    ? await prisma.menuItemVariant.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          label: true,
          menuItem: {
            select: {
              name: true,
              category: { select: { name: true } },
            },
          },
        },
      })
    : [];
  const byId = new Map(variants.map((v) => [v.id, v]));

  return lines.map((line) => {
    const v = line.menuVariantId ? byId.get(line.menuVariantId) : undefined;
    if (!v) return line.orderName;
    return formatMenuOrderName(
      v.menuItem.category.name,
      v.menuItem.name,
      v.label,
    );
  });
}
