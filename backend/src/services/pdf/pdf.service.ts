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

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(4)));
}

function buildNoteText(item: PdfItem): string {
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
  return noteLines.join("\n");
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

    const pageBottom = 780;
    const tableLeft = 40;
    const tableWidth = 515;
    // No. | Unit | Order | Price | Note
    const colWidths = [44, 58, 138, 68, 207];
    const colXs: number[] = [];
    {
      let x = tableLeft;
      for (const w of colWidths) {
        colXs.push(x);
        x += w;
      }
    }
    const padX = 8;
    const padY = 8;
    const headers = ["No.", "Unit", "Order", "Price", "Note"];

    const logo = logoPath();
    if (existsSync(logo)) {
      doc.image(logo, 40, 36, { height: 42 });
    } else {
      doc.fillColor("#111").font("Times-Italic").fontSize(26).text("Darine's", 40, 42, {
        lineBreak: false,
      });
    }
    doc
      .fillColor("#111")
      .font("Helvetica")
      .fontSize(10)
      .text("Cooking Dairy", 40, 82, { lineBreak: false });
    doc
      .fillColor("#111")
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("Catering Order", 320, 48, {
        width: 235,
        align: "right",
        lineBreak: false,
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
      const my = metaTop + rowIdx * 22;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111");
      doc.text(row[0], x, my, { continued: true, lineBreak: false });
      doc.font("Helvetica").text(` ${row[1]}`, { width: 230, lineBreak: false });
      doc
        .moveTo(x, my + 14)
        .lineTo(x + 240, my + 14)
        .strokeColor("#cccccc")
        .stroke();
    });

    let y = 190;

    const drawHeader = () => {
      const headerH = 22;
      doc.rect(tableLeft, y, tableWidth, headerH).fillAndStroke("#f2f2f2", "#222");
      let x = tableLeft;
      for (let i = 0; i < colWidths.length - 1; i++) {
        x += colWidths[i]!;
        doc
          .moveTo(x, y)
          .lineTo(x, y + headerH)
          .strokeColor("#222")
          .stroke();
      }
      doc.fillColor("#111").font("Helvetica-Bold").fontSize(9);
      headers.forEach((h, i) => {
        doc.text(h, colXs[i]! + padX, y + 6, {
          width: colWidths[i]! - padX * 2,
          align: i === 0 || i === 3 ? "center" : "left",
          lineBreak: false,
        });
      });
      y += headerH;
    };

    const measureRowHeight = (item: PdfItem, noteText: string) => {
      doc.font("Helvetica").fontSize(9);
      const orderH = doc.heightOfString(item.orderNameSnapshot || " ", {
        width: colWidths[2]! - padX * 2,
      });
      doc.fontSize(8);
      const noteH = noteText
        ? doc.heightOfString(noteText, { width: colWidths[4]! - padX * 2 })
        : 0;
      return Math.max(26, orderH + padY * 2, noteH + padY * 2);
    };

    const drawCellText = (
      text: string,
      colIndex: number,
      cellY: number,
      rowH: number,
      opts: { fontSize?: number; align?: "left" | "center" | "right"; bold?: boolean } = {},
    ) => {
      const fontSize = opts.fontSize ?? 9;
      const align = opts.align ?? "left";
      const cellX = colXs[colIndex]!;
      const cellW = colWidths[colIndex]!;
      const rightInset = align === "right" ? 8 : padX;
      const textX = cellX + padX;
      const textW = Math.max(8, cellW - padX - rightInset);

      doc
        .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(fontSize)
        .fillColor("#111");
      // Absolute position every cell; never rely on PDFKit's flowing cursor
      doc.text(text, textX, cellY + padY, {
        width: textW,
        height: Math.max(10, rowH - padY * 2),
        align,
        ellipsis: true,
        lineBreak: true,
      });
    };

    const strokeRowGrid = (rowTop: number, rowH: number) => {
      doc.save();
      doc.strokeColor("#222").lineWidth(1);
      doc.rect(tableLeft, rowTop, tableWidth, rowH).stroke();
      let vx = tableLeft;
      for (let i = 0; i < colWidths.length - 1; i++) {
        vx += colWidths[i]!;
        doc.moveTo(vx, rowTop).lineTo(vx, rowTop + rowH).stroke();
      }
      doc.restore();
    };

    drawHeader();

    for (const item of quotation.items) {
      const noteText = buildNoteText(item);
      const rowH = measureRowHeight(item, noteText);

      if (y + rowH > pageBottom) {
        doc.addPage();
        y = 40;
        drawHeader();
      }

      const rowTop = y;

      drawCellText(formatQty(item.quantity), 0, rowTop, rowH, {
        align: "center",
        fontSize: 9,
      });
      drawCellText(item.unitSnapshot || "", 1, rowTop, rowH, { fontSize: 9 });
      drawCellText(item.orderNameSnapshot || "", 2, rowTop, rowH, { fontSize: 9 });
      // Paper sample puts the group total in the Unit Price column
      drawCellText(money(item.lineTotalCents), 3, rowTop, rowH, {
        align: "right",
        fontSize: 9,
      });
      if (noteText) {
        drawCellText(noteText, 4, rowTop, rowH, { fontSize: 8 });
      }

      // Borders last so grid lines always sit on top of text
      strokeRowGrid(rowTop, rowH);

      y = rowTop + rowH;
    }

    const delivery =
      quotation.charges.find((c) => c.type === "DELIVERY")?.amountCents ?? 0;

    if (y + 90 > pageBottom) {
      doc.addPage();
      y = 40;
    } else {
      y += 16;
    }

    const totalsX = 360;
    doc.font("Helvetica").fontSize(11).fillColor("#111");
    doc.text(`Subtotal:`, totalsX, y, { lineBreak: false });
    doc.text(money(quotation.subtotalCents), totalsX + 90, y, {
      width: 100,
      align: "right",
      lineBreak: false,
    });
    y += 16;
    doc.text(`Delivery Charge:`, totalsX, y, { lineBreak: false });
    doc.text(money(delivery), totalsX + 90, y, {
      width: 100,
      align: "right",
      lineBreak: false,
    });
    y += 18;
    doc
      .moveTo(totalsX, y)
      .lineTo(totalsX + 190, y)
      .strokeColor("#222")
      .stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(13);
    doc.text(`Total:`, totalsX, y, { lineBreak: false });
    doc.text(money(quotation.grandTotalCents), totalsX + 90, y, {
      width: 100,
      align: "right",
      lineBreak: false,
    });

    y += 36;
    if (y > pageBottom) {
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
        { width: 515, lineBreak: false },
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
