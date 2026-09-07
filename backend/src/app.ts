import bcrypt from "bcryptjs";
import compression from "compression";
import jwt from "jsonwebtoken";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { env } from "./config/env.js";
import { cateringOrderPdfFilename } from "./lib/pdf-filename.js";
import { prisma } from "./lib/prisma.js";
import { upsertClientFromQuotation } from "./services/clients/upsert-client-from-quotation.js";
import { calculateQuotation } from "./services/calculations/quotation-calculation.service.js";
import { buildCateringOrderHtml } from "./services/pdf/catering-order-template.js";
import { renderCateringOrderPdf } from "./services/pdf/pdf.service.js";
import {
  resolveLineOrderNames,
  withVarietyInOrderNames,
} from "./services/quotations/variety-display.js";
import { groupLinesByCategory } from "./services/quotations/group-lines-by-category.js";
import {
  groupQuotationItemsForDisplay,
  type QuotationItemForDisplay,
} from "./services/quotations/group-quotation-items.js";

const app: express.Application = express();
app.disable("x-powered-by");
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function setPrivateCache(res: express.Response, seconds: number) {
  res.setHeader(
    "Cache-Control",
    `private, max-age=${seconds}, stale-while-revalidate=${Math.max(seconds, 60)}`,
  );
}

type AuthUser = { id: string; role: string; email: string };

function signToken(user: AuthUser) {
  return jwt.sign(user, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

function auth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser;
    (req as express.Request & { user: AuthUser }).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "quote-me" }));

app.post("/api/auth/login", async (req, res) => {
  const body = z
    .object({ email: z.string().email(), password: z.string().min(1) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: body.data.email } });
  if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken({ id: user.id, role: user.role, email: user.email });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

app.get("/api/auth/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: (req as express.Request & { user: AuthUser }).user.id },
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});


app.get("/api/menu", auth, async (_req, res) => {
  const catalogs = await prisma.menuCatalog.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      categories: {
        orderBy: { displayOrder: "asc" },
        include: {
          subcategories: { orderBy: { displayOrder: "asc" } },
          items: {
            where: { isActive: true },
            orderBy: { displayOrder: "asc" },
            include: { variants: { orderBy: { displayOrder: "asc" } } },
          },
        },
      },
      packages: {
        orderBy: { displayOrder: "asc" },
        include: { components: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  setPrivateCache(res, 300);
  res.json(catalogs);
});

app.get("/api/menu/catalogs/:code", auth, async (req, res) => {
  const catalog = await prisma.menuCatalog.findUnique({
    where: { code: req.params.code },
    include: {
      categories: {
        orderBy: { displayOrder: "asc" },
        include: {
          items: {
            where: { isActive: true },
            orderBy: { displayOrder: "asc" },
            include: { variants: { orderBy: { displayOrder: "asc" } } },
          },
        },
      },
      packages: {
        orderBy: { displayOrder: "asc" },
        include: { components: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!catalog) return res.status(404).json({ error: "Catalog not found" });
  res.json(catalog);
});

app.get("/api/clients", auth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const clients = await prisma.client.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      quotations: {
        select: {
          id: true,
          quotationNumber: true,
          status: true,
          grandTotalCents: true,
          eventDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const payload = clients.map((client) => {
    const byStatus: Record<string, number> = {};
    let totalValueCents = 0;
    for (const quote of client.quotations) {
      byStatus[quote.status] = (byStatus[quote.status] ?? 0) + 1;
      totalValueCents += quote.grandTotalCents;
    }
    const last = client.quotations[0] ?? null;
    return {
      id: client.id,
      name: client.name,
      company: client.company,
      phone: client.phone,
      email: client.email,
      address: client.address,
      notes: client.notes,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      stats: {
        quotationCount: client.quotations.length,
        totalValueCents,
        confirmedCount: byStatus.CONFIRMED ?? 0,
        approvedCount: byStatus.APPROVED ?? 0,
        draftCount: byStatus.DRAFT ?? 0,
        sentCount: byStatus.SENT ?? 0,
        byStatus,
        lastQuotationAt: last?.createdAt ?? null,
        lastQuotationNumber: last?.quotationNumber ?? null,
        lastEventDate: last?.eventDate ?? null,
      },
      recentQuotations: client.quotations.slice(0, 8),
    };
  });

  res.json(payload);
});

app.post("/api/clients", auth, async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      company: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      address: z.string().optional(),
      notes: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const client = await prisma.client.create({
    data: {
      ...body.data,
      email: body.data.email || null,
    },
  });
  res.status(201).json(client);
});

app.get("/api/clients/:id", auth, async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      quotations: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { deliveryLocation: true },
      },
    },
  });
  if (!client) return res.status(404).json({ error: "Not found" });
  const byStatus: Record<string, number> = {};
  let totalValueCents = 0;
  for (const quote of client.quotations) {
    byStatus[quote.status] = (byStatus[quote.status] ?? 0) + 1;
    totalValueCents += quote.grandTotalCents;
  }
  res.json({
    ...client,
    stats: {
      quotationCount: client.quotations.length,
      totalValueCents,
      byStatus,
      lastQuotationAt: client.quotations[0]?.createdAt ?? null,
    },
  });
});

app.put("/api/clients/:id", auth, async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).optional(),
      company: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: body.data,
  });
  res.json(client);
});

app.get("/api/delivery-locations", auth, async (req, res) => {
  const activeOnly = String(req.query.active ?? "") === "1";
  const locations = await prisma.deliveryLocation.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  setPrivateCache(res, 120);
  res.json(locations);
});

app.post("/api/delivery-locations", auth, async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      deliveryFeeCents: z.number().int().min(0),
      notes: z.string().optional().nullable(),
      displayOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  try {
    const location = await prisma.deliveryLocation.create({
      data: {
        name: body.data.name.trim(),
        deliveryFeeCents: body.data.deliveryFeeCents,
        notes: body.data.notes ?? null,
        displayOrder: body.data.displayOrder ?? 0,
        isActive: body.data.isActive ?? true,
      },
    });
    res.status(201).json(location);
  } catch {
    res.status(409).json({ error: "A location with this name already exists" });
  }
});

app.put("/api/delivery-locations/:id", auth, async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).optional(),
      deliveryFeeCents: z.number().int().min(0).optional(),
      notes: z.string().nullable().optional(),
      displayOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  try {
    const location = await prisma.deliveryLocation.update({
      where: { id: req.params.id },
      data: {
        ...body.data,
        name: body.data.name?.trim(),
      },
    });
    res.json(location);
  } catch {
    res.status(404).json({ error: "Location not found or name conflict" });
  }
});

app.delete("/api/delivery-locations/:id", auth, async (req, res) => {
  // Soft-delete so historical quotations keep the reference
  const location = await prisma.deliveryLocation.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  res.json(location);
});

app.get("/api/dashboard", auth, async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const where = status ? { status: status as never } : {};
  const [total, byStatus, valueAgg, upcoming] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.quotation.aggregate({ _sum: { grandTotalCents: true }, where }),
    prisma.quotation.findMany({
      where: {
        eventDate: { gte: new Date() },
        status: { in: ["APPROVED", "CONFIRMED", "SENT", "PENDING"] },
      },
      orderBy: { eventDate: "asc" },
      take: 10,
    }),
  ]);
  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  res.json({
    totalQuotations: total,
    byStatus: counts,
    totalQuotationValueCents: valueAgg._sum.grandTotalCents ?? 0,
    upcomingEvents: upcoming,
  });
});

app.post("/api/quotations/calculate", auth, (req, res) => {
  try {
    const result = calculateQuotation(req.body);
    res.json({
      ...result,
      displayLines: groupLinesByCategory(result.lines),
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Calc failed" });
  }
});

async function nextQuotationNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.quotation.count();
  return `Q-${year}-${String(count + 1).padStart(4, "0")}`;
}

const quotationBody = z.object({
  clientId: z.string().optional().nullable(),
  customerName: z.string().min(1),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  eventDate: z.string().optional().nullable(),
  eventTime: z.string().optional().nullable(),
  eventLocation: z.string().optional().nullable(),
  deliveryLocationId: z.string().optional().nullable(),
  guestCount: z.number().int().optional().nullable(),
  waiterCount: z.number().int().optional().nullable(),
  eventType: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z
    .enum([
      "DRAFT",
      "SENT",
      "PENDING",
      "APPROVED",
      "REJECTED",
      "EXPIRED",
      "CONFIRMED",
      "CANCELLED",
    ])
    .optional(),
  discount: z
    .object({ type: z.enum(["FIXED", "PERCENT"]), value: z.number() })
    .optional()
    .nullable(),
  charges: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["FIXED", "PERCENT", "DELIVERY", "SETUP", "SERVICE", "TAX", "CUSTOM"]),
        value: z.number(),
      }),
    )
    .optional(),
  guestRulesByGroup: z.record(z.any()).optional(),
  lines: z.array(
    z.object({
      key: z.string(),
      lineMode: z.enum(["PACKAGE", "A_LA_CARTE", "GUEST_BASED"]),
      orderName: z.string(),
      unit: z.string(),
      category: z.string().optional(),
      unitPriceCents: z.number().int(),
      quantity: z.number().finite().nonnegative().optional(),
      minimumQuantity: z.number().finite().nonnegative().nullable().optional(),
      roundingIncrement: z.number().finite().positive().nullable().optional(),
      guestGroupId: z.string().optional(),
      menuItemId: z.string().optional().nullable(),
      menuVariantId: z.string().optional().nullable(),
      menuPackageId: z.string().optional().nullable(),
      noteComponents: z
        .array(
          z.object({
            name: z.string(),
            quantity: z.number().finite().optional(),
            unit: z.string().optional(),
            groupName: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
});

app.get("/api/quotations", auth, async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
  const quotations = await prisma.quotation.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { client: true },
  });
  res.json(quotations);
});

app.post("/api/quotations", auth, async (req, res) => {
  const parsed = quotationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  let charges = data.charges ?? [];
  let deliveryLocationId = data.deliveryLocationId ?? null;
  if (deliveryLocationId) {
    const loc = await prisma.deliveryLocation.findUnique({
      where: { id: deliveryLocationId },
    });
    if (!loc || !loc.isActive) {
      return res.status(400).json({ error: "Invalid delivery location" });
    }
    const withoutDelivery = charges.filter((c) => c.type !== "DELIVERY");
    charges = [
      ...withoutDelivery,
      {
        name: `Delivery — ${loc.name}`,
        type: "DELIVERY" as const,
        value: loc.deliveryFeeCents / 100,
      },
    ];
  }

  const calc = calculateQuotation({
    guestCount: data.guestCount ?? undefined,
    lines: data.lines,
    guestRulesByGroup: data.guestRulesByGroup,
    charges,
    discount: data.discount,
  });
  const userId = (req as express.Request & { user: AuthUser }).user.id;
  const client = await upsertClientFromQuotation(prisma, {
    clientId: data.clientId,
    customerName: data.customerName,
    company: data.company,
    phone: data.phone,
    email: data.email,
    eventLocation: data.eventLocation,
  });
  const orderNames = await resolveLineOrderNames(data.lines);
  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber: await nextQuotationNumber(),
      clientId: client.id,
      createdById: userId,
      customerName: data.customerName,
      company: data.company ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      eventTime: data.eventTime ?? null,
      eventLocation: data.eventLocation ?? null,
      deliveryLocationId,
      guestCount: data.guestCount ?? null,
      waiterCount: data.waiterCount ?? null,
      eventType: data.eventType ?? null,
      notes: data.notes ?? null,
      status: data.status ?? "DRAFT",
      subtotalCents: calc.subtotalCents,
      discountCents: calc.discountCents,
      chargesCents: calc.chargesCents,
      taxCents: calc.taxCents,
      grandTotalCents: calc.grandTotalCents,
      items: {
        create: calc.lines.map((line, idx) => {
          const src = data.lines[idx];
          return {
            lineNumber: idx + 1,
            lineMode: line.lineMode,
            menuItemId: src.menuItemId ?? null,
            menuVariantId: src.menuVariantId ?? null,
            menuPackageId: src.menuPackageId ?? null,
            unitSnapshot: line.unit,
            orderNameSnapshot: orderNames[idx] ?? line.orderName,
            categorySnapshot: line.category ?? null,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            lineTotalCents: line.lineTotalCents,
            noteSnapshot: line.noteComponents
              ? JSON.stringify(line.noteComponents)
              : null,
            wasAutoCalculated: line.wasAutoCalculated,
            calcExplanation: line.calcExplanation,
            sortOrder: idx,
            components: line.noteComponents
              ? {
                  create: line.noteComponents.map((c, i) => ({
                    name: c.name,
                    quantity: c.quantity ?? null,
                    unit: c.unit ?? null,
                    groupName: c.groupName ?? null,
                    sortOrder: i,
                  })),
                }
              : undefined,
          };
        }),
      },
      charges: {
        create: calc.charges.map((c, i) => ({
          name: c.name,
          type: c.type as never,
          value: c.value,
          amountCents: c.amountCents,
          sortOrder: i,
        })),
      },
    },
    include: {
      items: { include: { components: true } },
      charges: true,
      deliveryLocation: true,
    },
  });
  res.status(201).json(quotation);
});

app.get("/api/quotations/:id", auth, async (req, res) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { components: true }, orderBy: { sortOrder: "asc" } },
      charges: { orderBy: { sortOrder: "asc" } },
      client: true,
      deliveryLocation: true,
    },
  });
  if (!quotation) return res.status(404).json({ error: "Not found" });
  const items = await withVarietyInOrderNames(quotation.items);
  const displayItems = groupQuotationItemsForDisplay(
    items as QuotationItemForDisplay[],
  );
  res.json({ ...quotation, items, displayItems });
});

app.put("/api/quotations/:id", auth, async (req, res) => {
  const existing = await prisma.quotation.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status === "CANCELLED") {
    return res.status(400).json({ error: "Cancelled quotations cannot be edited" });
  }
  const parsed = quotationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  let charges = data.charges ?? [];
  let deliveryLocationId = data.deliveryLocationId ?? null;
  if (deliveryLocationId) {
    const loc = await prisma.deliveryLocation.findUnique({
      where: { id: deliveryLocationId },
    });
    if (!loc || !loc.isActive) {
      return res.status(400).json({ error: "Invalid delivery location" });
    }
    const withoutDelivery = charges.filter((c) => c.type !== "DELIVERY");
    charges = [
      ...withoutDelivery,
      {
        name: `Delivery — ${loc.name}`,
        type: "DELIVERY" as const,
        value: loc.deliveryFeeCents / 100,
      },
    ];
  }

  const calc = calculateQuotation({
    guestCount: data.guestCount ?? undefined,
    lines: data.lines,
    guestRulesByGroup: data.guestRulesByGroup,
    charges,
    discount: data.discount,
  });

  const client = await upsertClientFromQuotation(prisma, {
    clientId: data.clientId,
    customerName: data.customerName,
    company: data.company,
    phone: data.phone,
    email: data.email,
    eventLocation: data.eventLocation,
  });

  await prisma.$transaction([
    prisma.quotationItem.deleteMany({ where: { quotationId: req.params.id } }),
    prisma.quotationCharge.deleteMany({ where: { quotationId: req.params.id } }),
  ]);

  const orderNames = await resolveLineOrderNames(data.lines);
  const quotation = await prisma.quotation.update({
    where: { id: req.params.id },
    data: {
      clientId: client.id,
      customerName: data.customerName,
      company: data.company ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      eventTime: data.eventTime ?? null,
      eventLocation: data.eventLocation ?? null,
      deliveryLocationId,
      guestCount: data.guestCount ?? null,
      waiterCount: data.waiterCount ?? null,
      eventType: data.eventType ?? null,
      notes: data.notes ?? null,
      status: data.status ?? undefined,
      subtotalCents: calc.subtotalCents,
      discountCents: calc.discountCents,
      chargesCents: calc.chargesCents,
      taxCents: calc.taxCents,
      grandTotalCents: calc.grandTotalCents,
      items: {
        create: calc.lines.map((line, idx) => {
          const src = data.lines[idx];
          return {
            lineNumber: idx + 1,
            lineMode: line.lineMode,
            menuItemId: src.menuItemId ?? null,
            menuVariantId: src.menuVariantId ?? null,
            menuPackageId: src.menuPackageId ?? null,
            unitSnapshot: line.unit,
            orderNameSnapshot: orderNames[idx] ?? line.orderName,
            categorySnapshot: line.category ?? null,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            lineTotalCents: line.lineTotalCents,
            noteSnapshot: line.noteComponents
              ? JSON.stringify(line.noteComponents)
              : null,
            wasAutoCalculated: line.wasAutoCalculated,
            calcExplanation: line.calcExplanation,
            sortOrder: idx,
            components: line.noteComponents
              ? {
                  create: line.noteComponents.map((c, i) => ({
                    name: c.name,
                    quantity: c.quantity ?? null,
                    unit: c.unit ?? null,
                    groupName: c.groupName ?? null,
                    sortOrder: i,
                  })),
                }
              : undefined,
          };
        }),
      },
      charges: {
        create: calc.charges.map((c, i) => ({
          name: c.name,
          type: c.type as never,
          value: c.value,
          amountCents: c.amountCents,
          sortOrder: i,
        })),
      },
    },
    include: {
      items: { include: { components: true } },
      charges: true,
      deliveryLocation: true,
    },
  });
  res.json(quotation);
});

app.post("/api/quotations/:id/duplicate", auth, async (req, res) => {
  const source = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { components: true } }, charges: true },
  });
  if (!source) return res.status(404).json({ error: "Not found" });
  const userId = (req as express.Request & { user: AuthUser }).user.id;
  const client = await upsertClientFromQuotation(prisma, {
    clientId: source.clientId,
    customerName: source.customerName,
    company: source.company,
    phone: source.phone,
    email: source.email,
    eventLocation: source.eventLocation,
  });
  const copy = await prisma.quotation.create({
    data: {
      quotationNumber: await nextQuotationNumber(),
      clientId: client.id,
      createdById: userId,
      customerName: source.customerName,
      company: source.company,
      phone: source.phone,
      email: source.email,
      eventDate: source.eventDate,
      eventTime: source.eventTime,
      eventLocation: source.eventLocation,
      deliveryLocationId: source.deliveryLocationId,
      guestCount: source.guestCount,
      waiterCount: source.waiterCount,
      eventType: source.eventType,
      notes: source.notes,
      status: "DRAFT",
      subtotalCents: source.subtotalCents,
      discountCents: source.discountCents,
      chargesCents: source.chargesCents,
      taxCents: source.taxCents,
      grandTotalCents: source.grandTotalCents,
      items: {
        create: source.items.map((item) => ({
          lineNumber: item.lineNumber,
          lineMode: item.lineMode,
          menuItemId: item.menuItemId,
          menuVariantId: item.menuVariantId,
          menuPackageId: item.menuPackageId,
          unitSnapshot: item.unitSnapshot,
          orderNameSnapshot: item.orderNameSnapshot,
          categorySnapshot: item.categorySnapshot,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.lineTotalCents,
          noteSnapshot: item.noteSnapshot,
          wasAutoCalculated: item.wasAutoCalculated,
          calcExplanation: item.calcExplanation,
          sortOrder: item.sortOrder,
          components: {
            create: item.components.map((c) => ({
              name: c.name,
              quantity: c.quantity,
              unit: c.unit,
              groupName: c.groupName,
              sortOrder: c.sortOrder,
            })),
          },
        })),
      },
      charges: {
        create: source.charges.map((c) => ({
          name: c.name,
          type: c.type,
          value: c.value,
          amountCents: c.amountCents,
          sortOrder: c.sortOrder,
        })),
      },
    },
    include: { items: { include: { components: true } }, charges: true },
  });
  res.status(201).json(copy);
});

app.post("/api/quotations/:id/status", auth, async (req, res) => {
  const body = z
    .object({
      status: z.enum([
        "DRAFT",
        "SENT",
        "PENDING",
        "APPROVED",
        "REJECTED",
        "EXPIRED",
        "CONFIRMED",
        "CANCELLED",
      ]),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const current = await prisma.quotation.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Not found" });
  if (current.status === "CANCELLED" && body.data.status !== "DRAFT") {
    return res.status(400).json({ error: "Cancelled quotation can only be reopened as Draft" });
  }
  const quotation = await prisma.quotation.update({
    where: { id: req.params.id },
    data: { status: body.data.status },
  });
  res.json(quotation);
});

app.get("/api/quotations/:id/pdf", auth, async (req, res) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { components: true }, orderBy: { sortOrder: "asc" } },
      charges: true,
      deliveryLocation: true,
    },
  });
  if (!quotation) return res.status(404).json({ error: "Not found" });
  const items = await withVarietyInOrderNames(quotation.items);
  const displayItems = groupQuotationItemsForDisplay(
    items as QuotationItemForDisplay[],
  );
  const forPdf = { ...quotation, items: displayItems };
  const company = {
    companyName: env.companyName,
    address: env.companyAddress,
    phone: env.companyPhone,
    instagram: env.companyInstagram,
  };
  void buildCateringOrderHtml(forPdf, company);
  const pdf = await renderCateringOrderPdf(forPdf, company);
  const filename = cateringOrderPdfFilename({
    customerName: quotation.customerName,
    eventDate: quotation.eventDate,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.send(pdf);
});

app.get("/api/quotations/:id/preview", auth, async (req, res) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { components: true }, orderBy: { sortOrder: "asc" } },
      charges: true,
    },
  });
  if (!quotation) return res.status(404).json({ error: "Not found" });
  const items = await withVarietyInOrderNames(quotation.items);
  const displayItems = groupQuotationItemsForDisplay(
    items as QuotationItemForDisplay[],
  );
  const html = buildCateringOrderHtml({ ...quotation, items: displayItems }, {
    companyName: env.companyName,
    address: env.companyAddress,
    phone: env.companyPhone,
    instagram: env.companyInstagram,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

/** Production: serve Vite PWA build from the same origin as the API. */
const distCandidates = [
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist"),
  path.resolve(process.cwd(), "frontend/dist"),
  path.resolve(process.cwd(), "../frontend/dist"),
];
const webDist = distCandidates.find((p) => existsSync(path.join(p, "index.html")));
if (webDist) {
  app.use(
    express.static(webDist, {
      maxAge: "1y",
      immutable: true,
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js") || filePath.includes("workbox")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
}

export { app };
