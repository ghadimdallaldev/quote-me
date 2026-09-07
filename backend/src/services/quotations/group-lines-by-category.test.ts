import { describe, expect, it } from "vitest";
import { groupLinesByCategory } from "./group-lines-by-category.js";

describe("groupLinesByCategory", () => {
  it("groups same-category a la carte lines and sums qty + totals", () => {
    const grouped = groupLinesByCategory([
      {
        key: "1",
        lineMode: "A_LA_CARTE",
        orderName: "Fatayer Sbenekh",
        unit: "Dozen",
        category: "Lebanese Corner",
        quantity: 3.5,
        unitPriceCents: 700,
        lineTotalCents: 2450,
      },
      {
        key: "2",
        lineMode: "A_LA_CARTE",
        orderName: "Pizza margarita",
        unit: "Dozen",
        category: "Lebanese Corner",
        quantity: 3.5,
        unitPriceCents: 800,
        lineTotalCents: 2800,
      },
      {
        key: "pkg",
        lineMode: "PACKAGE",
        orderName: "Lebanese box",
        unit: "BOX",
        quantity: 1,
        unitPriceCents: 3200,
        lineTotalCents: 3200,
      },
    ]);

    expect(grouped).toHaveLength(2);
    const lebanese = grouped.find((l) => l.orderName === "Lebanese Corner")!;
    expect(lebanese.quantity).toBe(7);
    expect(lebanese.lineTotalCents).toBe(5250);
    expect(lebanese.unitPriceCents).toBe(5250);
    expect(lebanese.noteComponents).toEqual([
      { name: "Fatayer Sbenekh", quantity: 3.5, unit: "Dozen" },
      { name: "Pizza margarita", quantity: 3.5, unit: "Dozen" },
    ]);
    expect(grouped.find((l) => l.key === "pkg")?.orderName).toBe("Lebanese box");
  });

  it("strips category prefix from note labels when present", () => {
    const grouped = groupLinesByCategory([
      {
        key: "1",
        lineMode: "A_LA_CARTE",
        orderName: "Fingerfood: Roast Beef (Soiree 3cm)",
        unit: "Dozen",
        category: "Fingerfood",
        quantity: 2,
        unitPriceCents: 900,
        lineTotalCents: 1800,
      },
      {
        key: "2",
        lineMode: "A_LA_CARTE",
        orderName: "Fingerfood: Beef Burger (Soiree 3cm)",
        unit: "Dozen",
        category: "Fingerfood",
        quantity: 2,
        unitPriceCents: 1000,
        lineTotalCents: 2000,
      },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.noteComponents?.map((c) => c.name)).toEqual([
      "Roast Beef (Soiree 3cm)",
      "Beef Burger (Soiree 3cm)",
    ]);
  });
});
