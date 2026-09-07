import {
  groupLinesByCategory,
  type GroupableLine,
} from "./group-lines-by-category.js";

export type QuotationItemForDisplay = {
  id: string;
  lineMode: string;
  orderNameSnapshot: string;
  unitSnapshot: string;
  categorySnapshot?: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  wasAutoCalculated?: boolean;
  components: Array<{
    id?: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    groupName: string | null;
  }>;
};

/** Map DB quotation items → grouped Catering Order rows (category in Order, varieties in Note). */
export function groupQuotationItemsForDisplay<T extends QuotationItemForDisplay>(
  items: T[],
): Array<
  Omit<T, "components"> & {
    components: QuotationItemForDisplay["components"];
  }
> {
  const asLines: GroupableLine[] = items.map((item) => ({
    key: item.id,
    lineMode: item.lineMode,
    orderName: item.orderNameSnapshot,
    unit: item.unitSnapshot,
    category: item.categorySnapshot ?? undefined,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: item.lineTotalCents,
    wasAutoCalculated: item.wasAutoCalculated,
    noteComponents:
      item.components?.length > 0
        ? item.components.map((c) => ({
            name: c.name,
            quantity: c.quantity ?? undefined,
            unit: c.unit ?? undefined,
            groupName: c.groupName ?? undefined,
          }))
        : undefined,
  }));

  return groupLinesByCategory(asLines).map((line, idx) => {
    const firstId = line.sourceKeys?.[0] ?? line.key;
    const base = items.find((i) => i.id === firstId) ?? items[idx]!;
    const components =
      line.noteComponents?.map((c, i) => ({
        id: `${line.key}-note-${i}`,
        name: c.name,
        quantity: c.quantity ?? null,
        unit: c.unit ?? null,
        groupName: c.groupName ?? null,
      })) ??
      base.components ??
      [];

    return {
      ...base,
      id: line.key,
      orderNameSnapshot: line.orderName,
      unitSnapshot: line.unit,
      categorySnapshot: line.category ?? base.categorySnapshot,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      wasAutoCalculated: line.wasAutoCalculated,
      components,
    };
  });
}
