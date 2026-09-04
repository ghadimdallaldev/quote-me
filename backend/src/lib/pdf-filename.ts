/** Safe Content-Disposition filename: Catering Order - Client - Date.pdf */
export function cateringOrderPdfFilename(params: {
  customerName: string;
  eventDate?: Date | string | null;
}): string {
  const client = sanitizeFilenamePart(params.customerName || "Client");
  const date = formatFilenameDate(params.eventDate);
  return `Catering Order - ${client} - ${date}.pdf`;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Client";
}

function formatFilenameDate(d?: Date | string | null): string {
  if (!d) {
    const now = new Date();
    return [
      String(now.getDate()).padStart(2, "0"),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getFullYear()),
    ].join("-");
  }
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.slice(0, 10).split("-");
    return `${day}-${m}-${y}`;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "undated";
  return [
    String(dt.getUTCDate()).padStart(2, "0"),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCFullYear()),
  ].join("-");
}
