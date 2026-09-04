import { mulQtyPrice } from "../../lib/money.js";

export interface LinePriceInput {
  quantity: number;
  unitPriceCents: number;
}

export interface LinePriceResult {
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export function calculateLinePrice(input: LinePriceInput): LinePriceResult {
  return {
    quantity: input.quantity,
    unitPriceCents: input.unitPriceCents,
    lineTotalCents: mulQtyPrice(input.quantity, input.unitPriceCents),
  };
}

export function sumLineTotals(lines: LinePriceResult[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
}
