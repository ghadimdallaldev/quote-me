import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, type MenuUnit } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, "seed-data");

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(seedDir, name), "utf8")) as T;
}

type Variant = {
  label: string;
  unit: MenuUnit;
  unitPriceCents: number;
  minimumQuantity?: number;
  roundingIncrement?: number;
  piecesPerUnit?: number;
  notes?: string;
};

type Item = {
  name: string;
  description?: string;
  variants: Variant[];
};

type Category = {
  name: string;
  notes?: string;
  items?: Item[];
  subcategories?: Array<{ name: string; notes?: string; items: Item[] }>;
};

async function upsertCatalog(code: string, name: string, displayOrder: number) {
  return prisma.menuCatalog.upsert({
    where: { code },
    update: { name, displayOrder },
    create: { code, name, displayOrder },
  });
}

async function seedItemCategory(
  catalogId: string,
  category: Category,
  categoryOrder: number,
) {
  const cat = await prisma.menuCategory.upsert({
    where: {
      catalogId_slug: { catalogId, slug: slugify(category.name) },
    },
    update: { name: category.name, notes: category.notes, displayOrder: categoryOrder },
    create: {
      catalogId,
      name: category.name,
      slug: slugify(category.name),
      notes: category.notes,
      displayOrder: categoryOrder,
    },
  });

  let itemOrder = 0;
  for (const item of category.items ?? []) {
    await seedItem(cat.id, null, item, itemOrder++);
  }
  let subOrder = 0;
  for (const sub of category.subcategories ?? []) {
    const subcategory = await prisma.menuSubcategory.upsert({
      where: {
        categoryId_slug: { categoryId: cat.id, slug: slugify(sub.name) },
      },
      update: { name: sub.name, displayOrder: subOrder },
      create: {
        categoryId: cat.id,
        name: sub.name,
        slug: slugify(sub.name),
        displayOrder: subOrder,
      },
    });
    subOrder++;
    for (const item of sub.items) {
      await seedItem(cat.id, subcategory.id, item, itemOrder++);
    }
  }
}

async function seedItem(
  categoryId: string,
  subcategoryId: string | null,
  item: Item,
  displayOrder: number,
) {
  const menuItem = await prisma.menuItem.upsert({
    where: {
      categoryId_slug: { categoryId, slug: slugify(item.name) },
    },
    update: {
      name: item.name,
      description: item.description,
      subcategoryId,
      displayOrder,
      isActive: true,
    },
    create: {
      categoryId,
      subcategoryId,
      name: item.name,
      slug: slugify(item.name),
      description: item.description,
      displayOrder,
    },
  });

  let vOrder = 0;
  for (const variant of item.variants) {
    await prisma.menuItemVariant.upsert({
      where: {
        menuItemId_slug: {
          menuItemId: menuItem.id,
          slug: slugify(variant.label),
        },
      },
      update: {
        label: variant.label,
        unit: variant.unit,
        unitPriceCents: variant.unitPriceCents,
        minimumQuantity: variant.minimumQuantity ?? null,
        roundingIncrement: variant.roundingIncrement ?? null,
        piecesPerUnit: variant.piecesPerUnit ?? null,
        notes: variant.notes ?? null,
        displayOrder: vOrder,
      },
      create: {
        menuItemId: menuItem.id,
        label: variant.label,
        slug: slugify(variant.label),
        unit: variant.unit,
        unitPriceCents: variant.unitPriceCents,
        minimumQuantity: variant.minimumQuantity ?? null,
        roundingIncrement: variant.roundingIncrement ?? null,
        piecesPerUnit: variant.piecesPerUnit ?? null,
        notes: variant.notes ?? null,
        displayOrder: vOrder,
      },
    });
    vOrder++;
  }
}

async function seedPackages(
  catalogId: string,
  packages: Array<{
    name: string;
    unitPriceCents: number;
    unit?: MenuUnit;
    totalPieces?: number;
    notes?: string;
    components?: Array<{
      name: string;
      quantity?: number | null;
      unit?: string;
      group?: string;
      isCustomizable?: boolean;
    }>;
  }>,
) {
  let order = 0;
  for (const pkg of packages) {
    const created = await prisma.menuPackage.upsert({
      where: {
        catalogId_slug: { catalogId, slug: slugify(pkg.name) },
      },
      update: {
        name: pkg.name,
        unitPriceCents: pkg.unitPriceCents,
        unit: pkg.unit ?? "BOX",
        totalPieces: pkg.totalPieces ?? null,
        notes: pkg.notes ?? null,
        displayOrder: order,
      },
      create: {
        catalogId,
        name: pkg.name,
        slug: slugify(pkg.name),
        unitPriceCents: pkg.unitPriceCents,
        unit: pkg.unit ?? "BOX",
        totalPieces: pkg.totalPieces ?? null,
        notes: pkg.notes ?? null,
        displayOrder: order,
      },
    });
    await prisma.menuPackageComponent.deleteMany({ where: { packageId: created.id } });
    let cOrder = 0;
    for (const c of pkg.components ?? []) {
      await prisma.menuPackageComponent.create({
        data: {
          packageId: created.id,
          name: c.name,
          quantity: c.quantity ?? null,
          unit: c.unit ?? null,
          groupName: c.group ?? null,
          isCustomizable: c.isCustomizable ?? false,
          sortOrder: cOrder++,
        },
      });
    }
    order++;
  }
}

async function main() {
  const password = process.env.SEED_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@darines.local" },
    update: { passwordHash, role: "ADMIN", name: "Admin" },
    create: {
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@darines.local",
      name: "Admin",
      role: "ADMIN",
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: process.env.SEED_OPS_EMAIL ?? "ops@darines.local" },
    update: { passwordHash, role: "OPS_MANAGER", name: "Operations Manager" },
    create: {
      email: process.env.SEED_OPS_EMAIL ?? "ops@darines.local",
      name: "Operations Manager",
      role: "OPS_MANAGER",
      passwordHash,
    },
  });

  const catering = loadJson<{
    code: string;
    name: string;
    categories: Category[];
  }>("catalog-catering.json");
  const cocktail = loadJson<{
    code: string;
    name: string;
    categories: Category[];
  }>("catalog-cocktail.json");
  const soiree = loadJson<{
    code: string;
    name: string;
    packages: Parameters<typeof seedPackages>[1];
  }>("catalog-soiree-box.json");
  const birthday = loadJson<{
    code: string;
    name: string;
    packages: Parameters<typeof seedPackages>[1];
  }>("catalog-birthday-box.json");
  const kids = loadJson<{
    code: string;
    name: string;
    packages: Parameters<typeof seedPackages>[1];
  }>("catalog-kids.json");

  const c1 = await upsertCatalog(catering.code, catering.name, 1);
  let i = 0;
  for (const category of catering.categories) {
    await seedItemCategory(c1.id, category, i++);
  }

  const c2 = await upsertCatalog(cocktail.code, cocktail.name, 2);

  // Rename legacy Fruit Cups short names before upsert (avoids duplicate slugs)
  const fruitCups = await prisma.menuCategory.findFirst({
    where: { catalogId: c2.id, name: "Fruit Cups" },
  });
  if (fruitCups) {
    const renames: Array<[string, string]> = [
      ["seasonal", "Seasonal fruit cups"],
      ["exotic", "Exotic fruit cups"],
    ];
    for (const [oldSlug, newName] of renames) {
      const existing = await prisma.menuItem.findUnique({
        where: {
          categoryId_slug: { categoryId: fruitCups.id, slug: oldSlug },
        },
      });
      if (existing) {
        await prisma.menuItem.update({
          where: { id: existing.id },
          data: { name: newName, slug: slugify(newName) },
        });
      }
    }
  }

  i = 0;
  for (const category of cocktail.categories) {
    await seedItemCategory(c2.id, category, i++);
  }

  const c3 = await upsertCatalog(soiree.code, soiree.name, 3);
  await seedPackages(c3.id, soiree.packages);

  const c4 = await upsertCatalog(birthday.code, birthday.name, 4);
  await seedPackages(c4.id, birthday.packages);

  const c5 = await upsertCatalog(kids.code, kids.name, 5);
  await seedPackages(c5.id, kids.packages);

  const deliveryZones = [
    { name: "Pickup / On site", deliveryFeeCents: 0, displayOrder: 0, notes: "No delivery charge" },
    { name: "Badaro", deliveryFeeCents: 500, displayOrder: 1 },
    { name: "Achrafieh", deliveryFeeCents: 700, displayOrder: 2 },
    { name: "Hamra", deliveryFeeCents: 800, displayOrder: 3 },
    { name: "Verdun", deliveryFeeCents: 800, displayOrder: 4 },
    { name: "Beirut suburbs", deliveryFeeCents: 1500, displayOrder: 5 },
    { name: "Mount Lebanon", deliveryFeeCents: 2500, displayOrder: 6 },
  ];
  for (const zone of deliveryZones) {
    await prisma.deliveryLocation.upsert({
      where: { name: zone.name },
      update: {
        deliveryFeeCents: zone.deliveryFeeCents,
        displayOrder: zone.displayOrder,
        notes: zone.notes ?? null,
        isActive: true,
      },
      create: {
        name: zone.name,
        deliveryFeeCents: zone.deliveryFeeCents,
        displayOrder: zone.displayOrder,
        notes: zone.notes ?? null,
      },
    });
  }

  console.log("Seed complete (idempotent).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
