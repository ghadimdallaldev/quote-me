import { prisma } from "../../lib/prisma.js";

type NamedLine = {
  orderNameSnapshot: string;
  menuVariantId?: string | null;
  unitSnapshot?: string;
};

/** Ensure variety/label appears on quotation line display names. */
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
    select: { id: true, label: true, unit: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  return items.map((item) => {
    if (!item.menuVariantId) return item;
    const v = byId.get(item.menuVariantId);
    if (!v?.label) return item;
    const name = item.orderNameSnapshot ?? "";
    if (name.toLowerCase().includes(v.label.toLowerCase())) return item;
    return {
      ...item,
      orderNameSnapshot: `${name} (${v.label})`,
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
        select: { id: true, label: true },
      })
    : [];
  const byId = new Map(variants.map((v) => [v.id, v.label]));

  return lines.map((line) => {
    const label = line.menuVariantId ? byId.get(line.menuVariantId) : undefined;
    if (!label) return line.orderName;
    if (line.orderName.toLowerCase().includes(label.toLowerCase())) {
      return line.orderName;
    }
    return `${line.orderName} (${label})`;
  });
}
