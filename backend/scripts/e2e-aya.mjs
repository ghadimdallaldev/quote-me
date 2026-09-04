import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const API = "http://localhost:4000";

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "ops@darines.local",
      password: "ChangeMe123!",
    }),
  }).then((r) => r.json());

  if (!login.token) throw new Error(`login failed: ${JSON.stringify(login)}`);
  const headers = {
    Authorization: `Bearer ${login.token}`,
    "Content-Type": "application/json",
  };

  const prisma = new PrismaClient();
  const byName = Object.fromEntries(
    (
      await prisma.menuPackage.findMany({
        where: { catalog: { code: "SOIREE_BOX" } },
        include: { components: true },
      })
    ).map((p) => [p.name.toLowerCase(), p]),
  );
  await prisma.$disconnect();

  // Aya sample used $35 for Lebanese box; menu seed is $32 — snapshot override via unitPriceCents
  const lines = [
    {
      key: "1",
      lineMode: "PACKAGE",
      orderName: "Lebanese box",
      unit: "Box",
      unitPriceCents: 3500,
      quantity: 1,
      menuPackageId: byName["lebanese box"]?.id,
      noteComponents: [
        { name: "Kibbeh", quantity: 24, unit: "pcs" },
        { name: "Sambousek lahme", quantity: 12, unit: "pcs" },
        { name: "Sambousek jebneh", quantity: 12, unit: "pcs" },
        { name: "Fatayer spinach", quantity: 12, unit: "pcs" },
      ],
    },
    {
      key: "2",
      lineMode: "PACKAGE",
      orderName: "Traditional breakfast box",
      unit: "Box",
      unitPriceCents: 1700,
      quantity: 1,
      menuPackageId: byName["traditional breakfast box"]?.id,
      noteComponents: [
        { name: "Keshek" },
        { name: "Mohammara" },
        { name: "Mix Cheese" },
        { name: "Zaatar with pomegranate" },
      ],
    },
    {
      key: "3",
      lineMode: "PACKAGE",
      orderName: "Pizza box",
      unit: "Box",
      unitPriceCents: 2300,
      quantity: 1,
      menuPackageId: byName["pizza box"]?.id,
      noteComponents: [
        { name: "Hawaiian" },
        { name: "Pepperoni" },
        { name: "Chicken bbq" },
        { name: "Margarita" },
      ],
    },
    {
      key: "4",
      lineMode: "PACKAGE",
      orderName: "Croissant Box",
      unit: "Box",
      unitPriceCents: 3000,
      quantity: 1,
      menuPackageId: byName["croissant box"]?.id,
      noteComponents: [
        { name: "Almond" },
        { name: "Chocolate" },
        { name: "Cheese" },
        { name: "Zaatar" },
      ],
    },
    {
      key: "5",
      lineMode: "PACKAGE",
      orderName: "Fingerfood lunch soiree",
      unit: "Box",
      unitPriceCents: 3400,
      quantity: 1,
      menuPackageId: byName["fingerfood lunch soiree box"]?.id,
      noteComponents: [
        { name: "Roast beef" },
        { name: "Chicken honey mustard" },
        { name: "Tuna mix" },
        { name: "Crab mix" },
        { name: "Beef burger" },
      ],
    },
    {
      key: "6",
      lineMode: "PACKAGE",
      orderName: "Fingerfood with salty tarts box",
      unit: "Box",
      unitPriceCents: 5900,
      quantity: 1,
      menuPackageId: byName["fingerfood with salty tarts box"]?.id,
      noteComponents: [
        { name: "Pesto halloumi", groupName: "Salty tarts" },
        { name: "Fetta with pomegranate", groupName: "Salty tarts" },
        { name: "Mushroom", groupName: "Salty tarts" },
        { name: "Turkey and cheese", groupName: "Fingerfood" },
        { name: "Chicken honey mustard", groupName: "Fingerfood" },
        { name: "Roast beef", groupName: "Fingerfood" },
      ],
    },
    {
      key: "7",
      lineMode: "A_LA_CARTE",
      orderName: "Sweets",
      unit: "Dozen",
      unitPriceCents: 2960,
      quantity: 5,
      noteComponents: [
        { name: "Decorated Choux", quantity: 2, unit: "dozen" },
        { name: "Decorated brownie", quantity: 2, unit: "dozen" },
        { name: "Cheesecake shots", quantity: 1, unit: "dozen" },
      ],
    },
  ];

  const calc = await fetch(`${API}/api/quotations/calculate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      lines,
      charges: [{ name: "Delivery Charge", type: "DELIVERY", value: 0 }],
    }),
  }).then((r) => r.json());

  console.log("calc totals", {
    subtotalCents: calc.subtotalCents,
    grandTotalCents: calc.grandTotalCents,
  });
  if (calc.grandTotalCents !== 34600) {
    throw new Error(`Expected 34600 cents, got ${calc.grandTotalCents}`);
  }

  const created = await fetch(`${API}/api/quotations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customerName: "Aya",
      phone: "70/984615",
      eventLocation: "Pickup at 3:00pm",
      eventDate: "2025-08-16",
      lines,
      charges: [{ name: "Delivery Charge", type: "DELIVERY", value: 0 }],
      status: "SENT",
    }),
  }).then((r) => r.json());

  console.log("created", created.quotationNumber, created.id, created.grandTotalCents);

  const pdfRes = await fetch(`${API}/api/quotations/${created.id}/pdf`, { headers });
  if (!pdfRes.ok) throw new Error(`pdf failed ${pdfRes.status} ${await pdfRes.text()}`);
  const buf = Buffer.from(await pdfRes.arrayBuffer());
  const out = new URL("../tmp-aya-quotation.pdf", import.meta.url);
  writeFileSync(out, buf);
  console.log("pdf bytes", buf.length, "wrote", out.pathname);
  console.log("pdf header", buf.subarray(0, 5).toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
