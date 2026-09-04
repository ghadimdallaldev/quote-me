export type CalcMethod =
  | "PER_GUEST_PER_VARIETY"
  | "DISTRIBUTED_ACROSS_VARIETIES"
  | "FIXED_UNIT"
  | "PACKAGE";

export interface QuantityRuleInput {
  method: CalcMethod;
  quantityPerGuest?: number | null;
  totalPiecesPerGuest?: number | null;
  roundingIncrement?: number | null;
  minimumQuantity?: number | null;
}

export interface QuantityCalcResult {
  quantity: number;
  rawQuantity: number;
  wasAutoCalculated: boolean;
  explanation: string;
}

/** Round up to nearest increment (e.g. 112 → 125 when increment=25). */
export function roundUpToIncrement(value: number, increment: number): number {
  if (increment <= 0) return Math.ceil(value);
  return Math.ceil(value / increment) * increment;
}

export function applyMinimumAndRounding(
  rawQuantity: number,
  minimumQuantity?: number | null,
  roundingIncrement?: number | null,
): number {
  let q = Math.ceil(rawQuantity);
  if (roundingIncrement && roundingIncrement > 0) {
    q = roundUpToIncrement(q, roundingIncrement);
  }
  if (minimumQuantity != null && minimumQuantity > 0) {
    q = Math.max(q, minimumQuantity);
  }
  return q;
}

export function calculateGuestBasedQuantity(params: {
  guestCount: number;
  varietyCount: number;
  rule: QuantityRuleInput;
}): QuantityCalcResult {
  const { guestCount, varietyCount, rule } = params;
  if (guestCount <= 0) {
    throw new Error("guestCount must be positive for guest-based calculation");
  }
  if (varietyCount <= 0) {
    throw new Error("varietyCount must be positive");
  }

  let raw = 0;
  let explanation = "";

  if (rule.method === "PER_GUEST_PER_VARIETY") {
    const perGuest = rule.quantityPerGuest ?? 0;
    raw = guestCount * perGuest;
    explanation = `${guestCount} guests × ${perGuest} per guest = ${raw} per variety`;
  } else if (rule.method === "DISTRIBUTED_ACROSS_VARIETIES") {
    const totalPerGuest = rule.totalPiecesPerGuest ?? 0;
    const total = guestCount * totalPerGuest;
    raw = total / varietyCount;
    explanation = `${guestCount} × ${totalPerGuest} = ${total} total ÷ ${varietyCount} varieties = ${raw} each`;
  } else {
    throw new Error(`Unsupported guest-based method: ${rule.method}`);
  }

  const quantity = applyMinimumAndRounding(
    raw,
    rule.minimumQuantity,
    rule.roundingIncrement,
  );

  if (quantity !== Math.ceil(raw) && quantity !== raw) {
    explanation += ` → adjusted to ${quantity}`;
  }

  return {
    quantity,
    rawQuantity: raw,
    wasAutoCalculated: true,
    explanation,
  };
}

export function calculateFixedUnitQuantity(params: {
  requestedQuantity: number;
  minimumQuantity?: number | null;
  roundingIncrement?: number | null;
}): QuantityCalcResult {
  const raw = params.requestedQuantity;
  if (!Number.isFinite(raw) || raw < 0) {
    throw new Error("requestedQuantity must be a non-negative number");
  }

  // Manual entry keeps exact decimals (e.g. 7.5 dozen) unless a packing
  // rounding increment is configured on the menu variant.
  let quantity = raw;
  if (params.roundingIncrement && params.roundingIncrement > 0) {
    quantity = roundUpToIncrement(raw, params.roundingIncrement);
  }
  if (params.minimumQuantity != null && params.minimumQuantity > 0) {
    quantity = Math.max(quantity, params.minimumQuantity);
  }

  return {
    quantity,
    rawQuantity: raw,
    wasAutoCalculated: quantity !== raw,
    explanation:
      quantity !== raw
        ? `Requested ${raw} adjusted to ${quantity} (min/rounding)`
        : `Quantity ${quantity}`,
  };
}
