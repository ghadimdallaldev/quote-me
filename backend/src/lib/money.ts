/** All money uses integer cents to avoid floating-point errors. */

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatUsd(cents: number): string {
  return `${centsToDollars(cents).toFixed(2)}$`;
}

export function mulQtyPrice(quantity: number, unitPriceCents: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("quantity must be a non-negative number");
  }
  if (!Number.isInteger(unitPriceCents)) {
    throw new Error("unitPriceCents must be an integer");
  }
  // Allow fractional qty (e.g. 7.5 dozen); keep money in whole cents.
  return Math.round(quantity * unitPriceCents);
}

export function percentOfCents(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}
