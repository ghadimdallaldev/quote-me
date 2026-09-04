export type MenuVariant = {
  id: string;
  label: string;
  unit: string;
  unitPriceCents: number;
  minimumQuantity?: number | null;
  roundingIncrement?: number | null;
};

export type MenuItem = {
  id: string;
  name: string;
  variants: MenuVariant[];
};

export type MenuPackage = {
  id: string;
  name: string;
  unit: string;
  unitPriceCents: number;
  components: Array<{
    name: string;
    quantity?: number | null;
    unit?: string | null;
    groupName?: string | null;
  }>;
};

export type Catalog = {
  id: string;
  code: string;
  name: string;
  categories: Array<{ id: string; name: string; items: MenuItem[] }>;
  packages: MenuPackage[];
};

export type BuilderLine = {
  key: string;
  lineMode: "PACKAGE" | "A_LA_CARTE" | "GUEST_BASED";
  orderName: string;
  unit: string;
  category?: string;
  unitPriceCents: number;
  quantity?: number;
  minimumQuantity?: number | null;
  roundingIncrement?: number | null;
  guestGroupId?: string;
  menuItemId?: string;
  menuVariantId?: string;
  menuPackageId?: string;
  noteComponents?: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    groupName?: string;
  }>;
};
