import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertClient(input) {
  const name = input.customerName.trim();
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;
  const company = input.company?.trim() || null;
  const address = input.eventLocation?.trim() || null;

  if (phone) {
    const byPhone = await prisma.client.findFirst({
      where: { phone: { equals: phone, mode: "insensitive" } },
    });
    if (byPhone) {
      return prisma.client.update({
        where: { id: byPhone.id },
        data: { name, company, email, address },
      });
    }
  }
  if (email) {
    const byEmail = await prisma.client.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (byEmail) {
      return prisma.client.update({
        where: { id: byEmail.id },
        data: { name, company, phone, address },
      });
    }
  }
  const byName = await prisma.client.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (byName) {
    return prisma.client.update({
      where: { id: byName.id },
      data: { name, company, phone, email, address },
    });
  }
  return prisma.client.create({
    data: { name, company, phone, email, address },
  });
}

const orphans = await prisma.quotation.findMany({
  where: { clientId: null },
  orderBy: { createdAt: "asc" },
});

let linked = 0;
for (const q of orphans) {
  const client = await upsertClient(q);
  await prisma.quotation.update({
    where: { id: q.id },
    data: { clientId: client.id },
  });
  linked++;
  console.log(`linked ${q.quotationNumber} -> ${client.name}`);
}

console.log(`Backfilled ${linked} quotations`);
await prisma.$disconnect();
