/** Shared display grouping: category = Order, varieties + qty = Notes. */

export type GroupableLine = {
  key: string;
  lineMode: string;
  orderName: string;
  unit: string;
  category?: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  wasAutoCalculated?: boolean;
  calcExplanation?: string;
  noteComponents?: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    groupName?: string;
  }>;
  sourceKeys?: string[];
};

function noteLabel(orderName: string, category?: string): string {
  const cat = (category ?? "").trim();
  if (cat) {
    const prefix = `${cat}:`;
    if (orderName.toLowerCase().startsWith(prefix.toLowerCase())) {
      return orderName.slice(prefix.length).trim();
    }
  }
  return orderName;
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(4)));
}

function buildGroup<T extends GroupableLine>(cat: string, members: T[]): T {
  if (members.length === 1) {
    const only = members[0]!;
    return {
      ...only,
      orderName: cat,
      noteComponents: [
        {
          name: noteLabel(only.orderName, cat),
          quantity: only.quantity,
          unit: only.unit,
        },
      ],
      sourceKeys: [only.key],
    };
  }

  const quantity = members.reduce((s, m) => s + m.quantity, 0);
  const lineTotalCents = members.reduce((s, m) => s + m.lineTotalCents, 0);
  const unit = members.every((m) => m.unit === members[0]!.unit)
    ? members[0]!.unit
    : "Mixed";
  const wasAutoCalculated = members.some((m) => m.wasAutoCalculated);

  return {
    ...members[0]!,
    key: `group:${cat}`,
    lineMode: members[0]!.lineMode,
    orderName: cat,
    category: cat,
    unit,
    quantity,
    unitPriceCents: lineTotalCents,
    lineTotalCents,
    wasAutoCalculated,
    calcExplanation: `Grouped ${members.length} varieties · total ${formatQty(quantity)} ${unit}`,
    noteComponents: members.map((m) => ({
      name: noteLabel(m.orderName, cat),
      quantity: m.quantity,
      unit: m.unit,
    })),
    sourceKeys: members.map((m) => m.key),
  };
}

/**
 * Collapse A_LA_CARTE / GUEST_BASED lines that share a category into one
 * display row. PACKAGE (and lines without category) stay as-is.
 * Preserves first-seen order of categories / packages.
 */
export function groupLinesByCategory<T extends GroupableLine>(lines: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const isGroupable =
      (line.lineMode === "A_LA_CARTE" || line.lineMode === "GUEST_BASED") &&
      Boolean(line.category?.trim());
    if (!isGroupable) continue;
    const cat = line.category!.trim();
    const list = groups.get(cat) ?? [];
    list.push(line);
    groups.set(cat, list);
  }

  const result: T[] = [];
  const flushed = new Set<string>();

  for (const line of lines) {
    const isGroupable =
      (line.lineMode === "A_LA_CARTE" || line.lineMode === "GUEST_BASED") &&
      Boolean(line.category?.trim());

    if (!isGroupable) {
      result.push(line);
      continue;
    }

    const cat = line.category!.trim();
    if (flushed.has(cat)) continue;
    flushed.add(cat);
    result.push(buildGroup(cat, groups.get(cat)!));
  }

  return result;
}
