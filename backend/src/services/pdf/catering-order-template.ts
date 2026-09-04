type CompanyInfo = {
  companyName: string;
  address: string;
  phone: string;
  instagram: string;
};

type QuotationForPdf = {
  quotationNumber: string;
  customerName: string;
  phone: string | null;
  eventLocation: string | null;
  eventDate: Date | null;
  guestCount: number | null;
  waiterCount: number | null;
  subtotalCents: number;
  grandTotalCents: number;
  items: Array<{
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
  }>;
  charges: Array<{ name: string; type: string; amountCents: number }>;
};

function money(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `${dollars}$` : `${dollars.toFixed(2)}$`;
}

function formatDate(d: Date | null) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("en-GB");
}

function renderNotes(
  components: QuotationForPdf["items"][number]["components"],
): string {
  const groups = new Map<string, typeof components>();
  const ungrouped: typeof components = [];
  for (const c of components) {
    if (c.groupName) {
      const list = groups.get(c.groupName) ?? [];
      list.push(c);
      groups.set(c.groupName, list);
    } else {
      ungrouped.push(c);
    }
  }
  const parts: string[] = [];
  for (const [group, list] of groups) {
    parts.push(`<div class="group">${escapeHtml(group)}</div>`);
    for (const c of list) {
      parts.push(bullet(c));
    }
  }
  for (const c of ungrouped) parts.push(bullet(c));
  return parts.join("");
}

function bullet(c: {
  name: string;
  quantity: number | null;
  unit: string | null;
}) {
  const qty =
    c.quantity != null
      ? ` (${c.quantity}${c.unit ? ` ${escapeHtml(c.unit)}` : " pcs"})`
      : "";
  return `<div>• ${escapeHtml(c.name)}${qty}</div>`;
}

export function buildCateringOrderHtml(
  quotation: QuotationForPdf,
  company: CompanyInfo,
): string {
  const delivery =
    quotation.charges.find((c) => c.type === "DELIVERY")?.amountCents ?? 0;

  const rows = quotation.items
    .map((item) => {
      // Aya sample: unit price for single-box lines; aggregated amount for multi-dozen sweets line
      const priceCell =
        item.quantity > 1 ? item.lineTotalCents : item.unitPriceCents;
      return `<tr>
        <td class="center">${item.quantity}</td>
        <td>${escapeHtml(item.unitSnapshot)}</td>
        <td>${escapeHtml(item.orderNameSnapshot)}</td>
        <td class="num">${money(priceCell)}</td>
        <td class="note">${renderNotes(item.components)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Catering Order ${escapeHtml(quotation.quotationNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 12px; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px; }
  .brand-mark {
    width: 72px; height: 72px; border-radius: 50%;
    background: linear-gradient(145deg, #0f6e6a, #173532);
    color: white; display: flex; align-items: center; justify-content: center;
    font-family: Georgia, "Times New Roman", serif; font-size: 28px; font-style: italic;
  }
  .brand-text .name { font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-style: italic; line-height: 1; }
  .brand-text .sub { font-size: 12px; letter-spacing: 0.04em; margin-top: 4px; color: #444; }
  .title { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; margin-bottom: 18px; }
  .meta div { border-bottom: 1px solid #cfcfcf; padding: 5px 0; }
  .meta strong { display: inline-block; min-width: 150px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #222; padding: 7px 8px; vertical-align: top; word-wrap: break-word; }
  th { background: #f2f2f2; text-align: left; font-size: 12px; }
  th:nth-child(1), td.center { width: 48px; text-align: center; }
  th:nth-child(2) { width: 70px; }
  th:nth-child(3) { width: 170px; }
  th:nth-child(4), td.num { width: 90px; text-align: right; white-space: nowrap; }
  td.note { font-size: 11px; line-height: 1.35; }
  td.note .group { font-weight: 700; margin-top: 4px; }
  .totals { margin-top: 18px; width: 260px; margin-left: auto; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .totals .grand { font-weight: 700; border-top: 1px solid #222; margin-top: 8px; padding-top: 8px; font-size: 15px; }
  .footer { margin-top: 28px; color: #666; font-size: 10px; border-top: 1px solid #ddd; padding-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <div style="display:flex; gap:12px; align-items:center;">
      <div class="brand-mark">D</div>
      <div class="brand-text">
        <div class="name">${escapeHtml(company.companyName)}</div>
        <div class="sub">Cooking Dairy</div>
      </div>
    </div>
    <div class="title">Catering Order</div>
  </div>
  <div class="meta">
    <div><strong>Customer Name:</strong> ${escapeHtml(quotation.customerName)}</div>
    <div><strong>Address:</strong> ${escapeHtml(quotation.eventLocation ?? "")}</div>
    <div><strong>Phone Number:</strong> ${escapeHtml(quotation.phone ?? "")}</div>
    <div><strong>Date:</strong> ${formatDate(quotation.eventDate)}</div>
    <div><strong>Number of attendees:</strong> ${quotation.guestCount ?? ""}</div>
    <div><strong>Number of Waiters:</strong> ${quotation.waiterCount ?? ""}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>Unit</th>
        <th>Order</th>
        <th>Unit Price</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal:</span><span>${money(quotation.subtotalCents)}</span></div>
    <div><span>Delivery Charge:</span><span>${money(delivery)}</span></div>
    <div class="grand"><span>Total:</span><span>${money(quotation.grandTotalCents)}</span></div>
  </div>
  <div class="footer">
    ${escapeHtml(company.address)} · ${escapeHtml(company.phone)} · ${escapeHtml(company.instagram)} · ${escapeHtml(quotation.quotationNumber)}
  </div>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
