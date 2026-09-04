import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
console.log(
  await p.deliveryLocation.findMany({ orderBy: { displayOrder: "asc" } }),
);
await p.$disconnect();
