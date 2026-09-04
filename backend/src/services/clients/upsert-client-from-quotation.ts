import type { PrismaClient } from "@prisma/client";

export type QuotationClientInput = {
  clientId?: string | null;
  customerName: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  eventLocation?: string | null;
};

/**
 * Ensure a Client row exists for quotation contact details.
 * Match order: explicit clientId → phone → email → exact name (case-insensitive).
 * Updates contact fields on match; creates when no match.
 */
export async function upsertClientFromQuotation(
  prisma: PrismaClient,
  input: QuotationClientInput,
) {
  const name = input.customerName.trim();
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;
  const company = input.company?.trim() || null;
  const address = input.eventLocation?.trim() || null;

  if (input.clientId) {
    const existing = await prisma.client.findUnique({
      where: { id: input.clientId },
    });
    if (existing) {
      return prisma.client.update({
        where: { id: existing.id },
        data: {
          name,
          ...(company != null ? { company } : {}),
          ...(phone != null ? { phone } : {}),
          ...(email != null ? { email } : {}),
          ...(address != null ? { address } : {}),
        },
      });
    }
  }

  if (phone) {
    const byPhone = await prisma.client.findFirst({
      where: { phone: { equals: phone, mode: "insensitive" } },
    });
    if (byPhone) {
      return prisma.client.update({
        where: { id: byPhone.id },
        data: {
          name,
          ...(company != null ? { company } : {}),
          ...(email != null ? { email } : {}),
          ...(address != null ? { address } : {}),
        },
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
        data: {
          name,
          ...(company != null ? { company } : {}),
          ...(phone != null ? { phone } : {}),
          ...(address != null ? { address } : {}),
        },
      });
    }
  }

  const byName = await prisma.client.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (byName) {
    return prisma.client.update({
      where: { id: byName.id },
      data: {
        name,
        ...(company != null ? { company } : {}),
        ...(phone != null ? { phone } : {}),
        ...(email != null ? { email } : {}),
        ...(address != null ? { address } : {}),
      },
    });
  }

  return prisma.client.create({
    data: {
      name,
      company,
      phone,
      email,
      address,
    },
  });
}
