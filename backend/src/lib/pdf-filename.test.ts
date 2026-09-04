import { describe, expect, it } from "vitest";
import { cateringOrderPdfFilename } from "./pdf-filename.js";

describe("cateringOrderPdfFilename", () => {
  it("formats Catering Order - client - date", () => {
    expect(
      cateringOrderPdfFilename({
        customerName: "Aya",
        eventDate: new Date("2025-08-16T12:00:00Z"),
      }),
    ).toBe("Catering Order - Aya - 16-08-2025.pdf");
  });

  it("sanitizes unsafe characters in client name", () => {
    expect(
      cateringOrderPdfFilename({
        customerName: 'Aya / "VIP"',
        eventDate: "2025-08-16",
      }),
    ).toBe("Catering Order - Aya VIP - 16-08-2025.pdf");
  });
});
