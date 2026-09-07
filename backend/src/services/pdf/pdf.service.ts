import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

type PdfItem = {
  quantity: number;
  unitSnapshot: string;
  orderNameSnapshot: string;
  unitPriceCents: number;
  lineTotalCents: number;
  components: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    groupName: string | null;
  }>;
};

type PdfQuotation = {
  quotationNumber: string;
  customerName: string;
  phone: string | null;
  eventLocation: string | null;
  eventDate: Date | string | null;
  guestCount: number | null;
  waiterCount: number | null;
  subtotalCents: number;
  grandTotalCents: number;
  items: PdfItem[];
  charges: Array<{ name: string; type: string; amountCents: number }>;
  deliveryLocation?: { name: string } | null;
};

type CompanyInfo = {
  companyName: string;
  address: string;
  phone: string;
  instagram: string;
};

function money(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `${dollars}$` : `${dollars.toFixed(2)}$`;
}

function formatDate(d: Date | string | null) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("en-GB");
}

function logoPath() {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "../../../assets/darines-logo.png");
}

/** Primary PDF generator — structured Aya-style layout via PDFKit (no Chromium required). */
export async function renderCateringOrderPdf(
  quotation: PdfQuotation,
  company: CompanyInfo,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const logo = logoPath();
    if (existsSync(logo)) {
      doc.image(logo, 40, 36, { height: 42 });
    } else {
      doc.fillColor("#111").font("Times-Italic").fontSize(26).text("Darine's", 40, 42);
    }
    doc
      .fillColor("#111")
      .font("Helvetica")
      .fontSize(10)
      .text("Cooking Dairy", 40, 82);
    doc.fillColor("#111").font("Helvetica-Bold").fontSize(22).text("Catering Order", 320, 48, {
      width: 235,
      align: "right",
    });

    const addressLine = [
      quotation.deliveryLocation?.name,
      quotation.eventLocation,
    ]
      .filter(Boolean)
      .join(" — ");

    const metaTop = 110;
    const leftX = 40;
    const rightX = 310;
    const meta = [
      ["Customer Name:", quotation.customerName],
      ["Phone Number:", quotation.phone ?? ""],
      ["Number of attendees:", quotation.guestCount?.toString() ?? ""],
      ["Address:", addressLine],
      ["Date:", formatDate(quotation.eventDate)],
      ["Number of Waiters:", quotation.waiterCount?.toString() ?? ""],
    ];
    meta.forEach((row, i) => {
      const col = i < 3 ? 0 : 1;
      const rowIdx = i % 3;
      const x = col === 0 ? leftX : rightX;
      const y = metaTop + rowIdx * 22;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111").text(row[0], x, y, {
        continued: true,
      });
      doc.font("Helvetica").text(` ${row[1]}`);
      doc
        .moveTo(x, y + 14)
        .lineTo(x + 240, y + 14)
        .strokeColor("#cccccc")
        .stroke();
    });

    // Table
    let y = 190;
    const cols = [40, 88, 158, 318, 400];
    const widths = [48, 70, 160, 82, 155];
    const headers = ["No.", "Unit", "Order", "Unit Price", "Note"];

    const drawHeader = () => {
      doc.rect(40, y, 515, 22).fillAndStroke("#f2f2f2", "#222");
      doc.fillColor("#111").font("Helvetica-Bold").fontSize(10);
      headers.forEach((h, i) => {
        doc.text(h, cols[i] + 4, y + 6, { width: widths[i] - 8 });
      });
      y += 22;
    };

    drawHeader();

    for (const item of quotation.items) {
      const noteLines: string[] = [];
      let lastGroup = "";
      for (const c of item.components) {
        if (c.groupName && c.groupName !== lastGroup) {
          noteLines.push(c.groupName);
          lastGroup = c.groupName;
        }
        const qtyPart =
          c.quantity != null
            ? ` (${c.quantity}${c.unit ? ` ${String(c.unit).toLowerCase()}` : ""})`
            : "";
        noteLines.push(`• ${c.name}${qtyPart}`);
      }
      const noteHeight = Math.max(28, noteLines.length * 11 + 10);
      if (y + noteHeight > 760) {
        doc.addPage();
        y = 40;
        drawHeader();
      }

      doc.strokeColor("#222").rect(40, y, 515, noteHeight).stroke();
      let x = 40;
      for (let i = 0; i < widths.length - 1; i++) {
        x += widths[i];
        doc.moveTo(x, y).lineTo(x, y + noteHeight).stroke();
      }

      // Paper sample puts the group total in the Unit Price column
      const price = item.lineTotalCents;
      doc.font("Helvetica").fontSize(10).fillColor("#111");
      doc.text(String(item.quantity), cols[0], y + 6, {
        width: widths[0],
        align: "center",
      });
      doc.text(item.unitSnapshot, cols[1] + 4, y + 6, { width: widths[1] - 8 });
      doc.text(item.orderNameSnapshot, cols[2] + 4, y + 6, {
        width: widths[2] - 8,
      });
      doc.text(money(price), cols[3] + 4, y + 6, {
        width: widths[3] - 8,
        align: "right",
      });
      doc.fontSize(9).text(noteLines.join("\n"), cols[4] + 4, y + 5, {
        width: widths[4] - 8,
      });
      y += noteHeight;
    }

    const delivery =
      quotation.charges.find((c) => c.type === "DELIVERY")?.amountCents ?? 0;
    y += 16;
    const totalsX = 360;
    doc.font("Helvetica").fontSize(11);
    doc.text(`Subtotal:`, totalsX, y);
    doc.text(money(quotation.subtotalCents), totalsX + 90, y, {
      width: 100,
      align: "right",
    });
    y += 16;
    doc.text(`Delivery Charge:`, totalsX, y);
    doc.text(money(delivery), totalsX + 90, y, { width: 100, align: "right" });
    y += 18;
    doc
      .moveTo(totalsX, y)
      .lineTo(totalsX + 190, y)
      .strokeColor("#222")
      .stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(13);
    doc.text(`Total:`, totalsX, y);
    doc.text(money(quotation.grandTotalCents), totalsX + 90, y, {
      width: 100,
      align: "right",
    });

    y += 36;
    if (y > 780) {
      doc.addPage();
      y = 40;
    }
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666")
      .text(
        `${company.address} · ${company.phone} · ${company.instagram} · ${quotation.quotationNumber}`,
        40,
        y,
        { width: 515 },
      );

    doc.end();
  });
}

/** HTML-to-PDF fallback without Chromium (keeps Railway cheap). */
export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    doc.fontSize(12).text(text);
    doc.end();
  });
}
