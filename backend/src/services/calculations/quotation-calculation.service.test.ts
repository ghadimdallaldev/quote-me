import { describe, expect, it } from "vitest";
import {
  applyMinimumAndRounding,
  calculateGuestBasedQuantity,
  roundUpToIncrement,
} from "./quantity-calculation.service.js";
import { calculateLinePrice } from "./pricing-calculation.service.js";
import { calculateQuotation } from "./quotation-calculation.service.js";
import { dollarsToCents, mulQtyPrice } from "../../lib/money.js";

describe("money", () => {
  it("converts dollars to cents without float drift", () => {
    expect(dollarsToCents(1.5)).toBe(150);
    expect(dollarsToCents(4.5)).toBe(450);
    expect(mulQtyPrice(300, 150)).toBe(45000);
  });
});

describe("quantity calculation", () => {
  it("distributes total pieces across varieties", () => {
    const result = calculateGuestBasedQuantity({
      guestCount: 100,
      varietyCount: 3,
      rule: {
        method: "DISTRIBUTED_ACROSS_VARIETIES",
        totalPiecesPerGuest: 9,
      },
    });
    expect(result.quantity).toBe(300);
    expect(result.wasAutoCalculated).toBe(true);
  });

  it("calculates per guest per variety", () => {
    const result = calculateGuestBasedQuantity({
      guestCount: 100,
      varietyCount: 3,
      rule: {
        method: "PER_GUEST_PER_VARIETY",
        quantityPerGuest: 3,
      },
    });
    expect(result.quantity).toBe(300);
  });

  it("rounds up to nearest 25", () => {
    expect(roundUpToIncrement(112, 25)).toBe(125);
  });

  it("applies minimum quantity", () => {
    expect(applyMinimumAndRounding(70, 100, null)).toBe(100);
  });
});

describe("pricing + quotation totals", () => {
  it("prices a line", () => {
    expect(calculateLinePrice({ quantity: 300, unitPriceCents: 150 })).toEqual({
      quantity: 300,
      unitPriceCents: 150,
      lineTotalCents: 45000,
    });
  });

  it("calculates package lines with delivery like Aya sample structure", () => {
    const result = calculateQuotation({
      lines: [
        {
          key: "1",
          lineMode: "PACKAGE",
          orderName: "Lebanese box",
          unit: "Box",
          unitPriceCents: 3500,
          quantity: 1,
        },
        {
          key: "2",
          lineMode: "PACKAGE",
          orderName: "Traditional breakfast box",
          unit: "Box",
          unitPriceCents: 1700,
          quantity: 1,
        },
        {
          key: "3",
          lineMode: "PACKAGE",
          orderName: "Pizza box",
          unit: "Box",
          unitPriceCents: 2300,
          quantity: 1,
        },
        {
          key: "4",
          lineMode: "PACKAGE",
          orderName: "Croissant Box",
          unit: "Box",
          unitPriceCents: 3000,
          quantity: 1,
        },
        {
          key: "5",
          lineMode: "PACKAGE",
          orderName: "Fingerfood lunch soiree",
          unit: "Box",
          unitPriceCents: 3400,
          quantity: 1,
        },
        {
          key: "6",
          lineMode: "PACKAGE",
          orderName: "Fingerfood with salty tarts box",
          unit: "Box",
          unitPriceCents: 5900,
          quantity: 1,
        },
        {
          key: "7",
          lineMode: "A_LA_CARTE",
          orderName: "Sweets",
          unit: "Dozen",
          // Sample shows aggregate line total 148 for qty 5
          unitPriceCents: 2960,
          quantity: 5,
        },
      ],
      charges: [{ name: "Delivery Charge", type: "DELIVERY", value: 0 }],
    });

    expect(result.subtotalCents).toBe(34600);
    expect(result.grandTotalCents).toBe(34600);
  });

  it("applies percent discount and tax", () => {
    const result = calculateQuotation({
      lines: [
        {
          key: "1",
          lineMode: "A_LA_CARTE",
          orderName: "Item",
          unit: "Dozen",
          unitPriceCents: 10000,
          quantity: 1,
        },
      ],
      discount: { type: "PERCENT", value: 10 },
      charges: [{ name: "VAT", type: "TAX", value: 11 }],
    });
    expect(result.discountCents).toBe(1000);
    expect(result.taxCents).toBe(990); // 11% of 9000
    expect(result.grandTotalCents).toBe(9990);
  });

  it("guest-based group shares calculated quantity", () => {
    const result = calculateQuotation({
      guestCount: 100,
      guestRulesByGroup: {
        fingerfood: {
          method: "DISTRIBUTED_ACROSS_VARIETIES",
          totalPiecesPerGuest: 9,
        },
      },
      lines: [
        {
          key: "a",
          lineMode: "GUEST_BASED",
          guestGroupId: "fingerfood",
          orderName: "Food A",
          unit: "Piece",
          unitPriceCents: 150,
        },
        {
          key: "b",
          lineMode: "GUEST_BASED",
          guestGroupId: "fingerfood",
          orderName: "Food B",
          unit: "Piece",
          unitPriceCents: 150,
        },
        {
          key: "c",
          lineMode: "GUEST_BASED",
          guestGroupId: "fingerfood",
          orderName: "Food C",
          unit: "Piece",
          unitPriceCents: 150,
        },
      ],
    });
    expect(result.lines.every((l) => l.quantity === 300)).toBe(true);
    expect(result.subtotalCents).toBe(135000);
  });

  it("prices fractional quantities (e.g. 7.5 dozen)", () => {
    expect(mulQtyPrice(7.5, 1500)).toBe(11250);
    expect(calculateLinePrice({ quantity: 7.5, unitPriceCents: 1500 })).toEqual({
      quantity: 7.5,
      unitPriceCents: 1500,
      lineTotalCents: 11250,
    });
  });

  it("keeps manual fractional qty without ceiling", () => {
    const result = calculateQuotation({
      lines: [
        {
          key: "d",
          lineMode: "A_LA_CARTE",
          orderName: "Mini pizza",
          unit: "Dozen",
          unitPriceCents: 1500,
          quantity: 7.5,
        },
      ],
    });
    expect(result.lines[0]?.quantity).toBe(7.5);
    expect(result.lines[0]?.lineTotalCents).toBe(11250);
  });
});
