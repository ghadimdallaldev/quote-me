import { percentOfCents } from "../../lib/money.js";
import {
  calculateFixedUnitQuantity,
  calculateGuestBasedQuantity,
  type QuantityRuleInput,
} from "./quantity-calculation.service.js";
import {
  calculateLinePrice,
  sumLineTotals,
} from "./pricing-calculation.service.js";

export type LineMode = "PACKAGE" | "A_LA_CARTE" | "GUEST_BASED";

export interface CalculateChargeInput {
  name: string;
  type: "FIXED" | "PERCENT" | "DELIVERY" | "SETUP" | "SERVICE" | "TAX" | "CUSTOM";
  value: number;
}

export interface CalculateLineInput {
  key: string;
  lineMode: LineMode;
  orderName: string;
  unit: string;
  category?: string;
  unitPriceCents: number;
  /** For PACKAGE / A_LA_CARTE */
  quantity?: number;
  minimumQuantity?: number | null;
  roundingIncrement?: number | null;
  /** For GUEST_BASED grouping */
  guestGroupId?: string;
  noteComponents?: Array<{ name: string; quantity?: number; unit?: string; groupName?: string }>;
}

export interface CalculateQuotationInput {
  guestCount?: number;
  lines: CalculateLineInput[];
  guestRulesByGroup?: Record<string, QuantityRuleInput>;
  charges?: CalculateChargeInput[];
  discount?: { type: "FIXED" | "PERCENT"; value: number } | null;
}

export interface CalculatedLine {
  key: string;
  lineMode: LineMode;
  orderName: string;
  unit: string;
  category?: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  wasAutoCalculated: boolean;
  calcExplanation: string;
  noteComponents?: CalculateLineInput["noteComponents"];
}

export interface CalculateQuotationResult {
  lines: CalculatedLine[];
  categoryTotals: Record<string, number>;
  subtotalCents: number;
  discountCents: number;
  charges: Array<{ name: string; type: string; value: number; amountCents: number }>;
  chargesCents: number;
  taxCents: number;
  grandTotalCents: number;
}

export function calculateQuotation(
  input: CalculateQuotationInput,
): CalculateQuotationResult {
  const guestGroups = new Map<string, CalculateLineInput[]>();
  for (const line of input.lines) {
    if (line.lineMode === "GUEST_BASED") {
      const gid = line.guestGroupId ?? "default";
      const list = guestGroups.get(gid) ?? [];
      list.push(line);
      guestGroups.set(gid, list);
    }
  }

  const guestQtyByKey = new Map<string, ReturnType<typeof calculateGuestBasedQuantity>>();
  for (const [groupId, groupLines] of guestGroups) {
    const rule = input.guestRulesByGroup?.[groupId];
    if (!rule) {
      throw new Error(`Missing guest quantity rule for group ${groupId}`);
    }
    if (!input.guestCount) {
      throw new Error("guestCount required for guest-based lines");
    }
    const result = calculateGuestBasedQuantity({
      guestCount: input.guestCount,
      varietyCount: groupLines.length,
      rule,
    });
    for (const line of groupLines) {
      guestQtyByKey.set(line.key, result);
    }
  }

  const lines: CalculatedLine[] = input.lines.map((line) => {
    if (line.lineMode === "GUEST_BASED") {
      const qty = guestQtyByKey.get(line.key)!;
      const priced = calculateLinePrice({
        quantity: qty.quantity,
        unitPriceCents: line.unitPriceCents,
      });
      return {
        key: line.key,
        lineMode: line.lineMode,
        orderName: line.orderName,
        unit: line.unit,
        category: line.category,
        quantity: priced.quantity,
        unitPriceCents: priced.unitPriceCents,
        lineTotalCents: priced.lineTotalCents,
        wasAutoCalculated: qty.wasAutoCalculated,
        calcExplanation: qty.explanation,
        noteComponents: line.noteComponents,
      };
    }

    const qty = calculateFixedUnitQuantity({
      requestedQuantity: line.quantity ?? 1,
      minimumQuantity: line.minimumQuantity,
      roundingIncrement: line.roundingIncrement,
    });
    const priced = calculateLinePrice({
      quantity: qty.quantity,
      unitPriceCents: line.unitPriceCents,
    });
    return {
      key: line.key,
      lineMode: line.lineMode,
      orderName: line.orderName,
      unit: line.unit,
      category: line.category,
      quantity: priced.quantity,
      unitPriceCents: priced.unitPriceCents,
      lineTotalCents: priced.lineTotalCents,
      wasAutoCalculated: qty.wasAutoCalculated,
      calcExplanation: qty.explanation,
      noteComponents: line.noteComponents,
    };
  });

  const subtotalCents = sumLineTotals(lines);

  let discountCents = 0;
  if (input.discount) {
    discountCents =
      input.discount.type === "PERCENT"
        ? percentOfCents(subtotalCents, input.discount.value)
        : Math.round(input.discount.value * 100);
  }

  const afterDiscount = Math.max(0, subtotalCents - discountCents);

  const chargeRows: CalculateQuotationResult["charges"] = [];
  let chargesCents = 0;
  let taxCents = 0;

  for (const charge of input.charges ?? []) {
    let amountCents = 0;
    if (charge.type === "PERCENT" || charge.type === "TAX") {
      amountCents = percentOfCents(afterDiscount, charge.value);
    } else {
      amountCents = Math.round(charge.value * 100);
    }
    chargeRows.push({
      name: charge.name,
      type: charge.type,
      value: charge.value,
      amountCents,
    });
    if (charge.type === "TAX") {
      taxCents += amountCents;
    } else {
      chargesCents += amountCents;
    }
  }

  const grandTotalCents = afterDiscount + chargesCents + taxCents;

  const categoryTotals: Record<string, number> = {};
  for (const line of lines) {
    const cat = line.category ?? "Uncategorized";
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + line.lineTotalCents;
  }

  return {
    lines,
    categoryTotals,
    subtotalCents,
    discountCents,
    charges: chargeRows,
    chargesCents,
    taxCents,
    grandTotalCents,
  };
}
