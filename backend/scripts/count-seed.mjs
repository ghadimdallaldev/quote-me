import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const [catalogs, items, packages, users] = await Promise.all([
  p.menuCatalog.count(),
  p.menuItem.count(),
  p.menuPackage.count(),
  p.user.count(),
]);
console.log({ catalogs, items, packages, users });
await p.$disconnect();
