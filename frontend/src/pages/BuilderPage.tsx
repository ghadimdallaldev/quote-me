import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { money } from "../lib/format";
import type {
  BuilderLine,
  Catalog,
  MenuItem,
  MenuPackage,
  MenuVariant,
} from "../lib/types";

const GENERIC_VARIANT_LABELS = new Set([
  "dozen",
  "piece",
  "portion",
  "box",
  "person",
  "cake",
  "shot",
  "jar",
  "tower",
  "custom",
]);

/** "Lebanese Corner: Fatayer Sbenekh" or "Fingerfood: Roast Beef (Soiree 3cm)" */
function formatOrderName(
  categoryName: string,
  itemName: string,
  variantLabel?: string,
) {
  const category = categoryName.trim();
  const base = category ? `${category}: ${itemName}` : itemName;
  const label = (variantLabel ?? "").trim();
  if (!label) return base;
  if (GENERIC_VARIANT_LABELS.has(label.toLowerCase())) return base;
  if (base.toLowerCase().includes(label.toLowerCase())) return base;
  if (itemName.toLowerCase() === label.toLowerCase()) return base;
  return `${base} (${label})`;
}

function MenuAddRow({
  title,
  subtitle,
  priceLabel,
  unitLabel,
  defaultQty,
  onAdd,
  addLabel,
  extraActions,
}: {
  title: string;
  subtitle?: string;
  priceLabel?: string;
  unitLabel: string;
  defaultQty: number;
  onAdd: (qty: number) => void;
  addLabel: string;
  extraActions?: ReactNode;
}) {
  const [qty, setQty] = useState(String(defaultQty));
  return (
    <div className="menu-item">
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <strong>{title}</strong>
        {priceLabel ? <span>{priceLabel}</span> : null}
      </div>
      {subtitle ? (
        <div className="muted" style={{ fontSize: 12 }}>
          {subtitle}
        </div>
      ) : null}
      <div className="row" style={{ marginTop: 6, alignItems: "center" }}>
        <label className="muted" style={{ fontSize: 12 }}>
          Qty ({unitLabel})
        </label>
        <input
          type="number"
          inputMode="decimal"
          min={0.5}
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="qty-input"
        />
        <button
          className="ghost"
          onClick={() => {
            const n = Number(qty);
            const amount =
              Number.isFinite(n) && n > 0 ? n : defaultQty;
            onAdd(amount);
            setQty(String(defaultQty));
          }}
        >
          {addLabel}
        </button>
        {extraActions}
      </div>
    </div>
  );
}

export default function BuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [catalogCode, setCatalogCode] = useState("SOIREE_BOX");
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [clientId, setClientId] = useState("");
  const [existingClients, setExistingClients] = useState<
    Array<{ id: string; name: string; phone?: string | null; company?: string | null }>
  >([]);
  const [eventLocation, setEventLocation] = useState("");
  const [deliveryLocationId, setDeliveryLocationId] = useState("");
  const [deliveryLocations, setDeliveryLocations] = useState<
    Array<{ id: string; name: string; deliveryFeeCents: number }>
  >([]);
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState(0);
  const [lines, setLines] = useState<BuilderLine[]>([]);
  const [delivery, setDelivery] = useState(0);
  const [calc, setCalc] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [guestGroupSelected, setGuestGroupSelected] = useState<string[]>([]);
  const [mobileTab, setMobileTab] = useState<"menu" | "order" | "summary">("menu");

  useEffect(() => {
    api.menu().then((m) => setCatalogs(m as Catalog[])).catch(console.error);
    api
      .deliveryLocations(true)
      .then((rows) =>
        setDeliveryLocations(
          rows as Array<{ id: string; name: string; deliveryFeeCents: number }>,
        ),
      )
      .catch(console.error);
    api
      .clients()
      .then((rows) =>
        setExistingClients(
          (
            rows as Array<{
              id: string;
              name: string;
              phone?: string | null;
              company?: string | null;
            }>
          ).map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            company: c.company,
          })),
        ),
      )
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .getQuotation(id)
      .then((q) => {
        const quotation = q as Record<string, unknown>;
        if (String(quotation.status) === "CANCELLED") {
          window.alert("This order is cancelled and cannot be edited.");
          navigate(`/quotations/${id}`, { replace: true });
          return;
        }
        setCustomerName(String(quotation.customerName ?? ""));
        setPhone(String(quotation.phone ?? ""));
        setClientId(quotation.clientId ? String(quotation.clientId) : "");
        setEventLocation(String(quotation.eventLocation ?? ""));
        setDeliveryLocationId(
          quotation.deliveryLocationId ? String(quotation.deliveryLocationId) : "",
        );
        const deliveryCharge = (
          (quotation.charges as Array<Record<string, unknown>>) ?? []
        ).find((c) => c.type === "DELIVERY");
        if (deliveryCharge) {
          setDelivery(
            Number(deliveryCharge.value) || Number(deliveryCharge.amountCents) / 100 || 0,
          );
        }
        setGuestCount(Number(quotation.guestCount ?? 0));
        const items = (quotation.items as Array<Record<string, unknown>>) ?? [];
        setLines(
          items.map((item, idx) => ({
            key: String(item.id ?? idx),
            lineMode: String(item.lineMode) as BuilderLine["lineMode"],
            orderName: String(item.orderNameSnapshot),
            unit: String(item.unitSnapshot),
            category: item.categorySnapshot ? String(item.categorySnapshot) : undefined,
            unitPriceCents: Number(item.unitPriceCents),
            quantity: Number(item.quantity),
            menuItemId: item.menuItemId ? String(item.menuItemId) : undefined,
            menuVariantId: item.menuVariantId ? String(item.menuVariantId) : undefined,
            menuPackageId: item.menuPackageId ? String(item.menuPackageId) : undefined,
            noteComponents: ((item.components as Array<Record<string, unknown>>) ?? []).map(
              (c) => ({
                name: String(c.name),
                quantity: c.quantity != null ? Number(c.quantity) : undefined,
                unit: c.unit ? String(c.unit) : undefined,
                groupName: c.groupName ? String(c.groupName) : undefined,
              }),
            ),
          })),
        );
      })
      .catch(console.error);
  }, [id]);

  const catalog = catalogs.find((c) => c.code === catalogCode);
  const filteredPackages = useMemo(() => {
    const q = search.toLowerCase();
    return (catalog?.packages ?? []).filter((p) => p.name.toLowerCase().includes(q));
  }, [catalog, search]);
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return (catalog?.categories ?? []).flatMap((cat) =>
      cat.items
        .filter((i) => i.name.toLowerCase().includes(q))
        .map((i) => ({ ...i, categoryName: cat.name })),
    );
  }, [catalog, search]);

  useEffect(() => {
    if (lines.length === 0) {
      setCalc(null);
      return;
    }
    const guestRulesByGroup = lines.some((l) => l.lineMode === "GUEST_BASED")
      ? {
          fingerfood: {
            method: "DISTRIBUTED_ACROSS_VARIETIES",
            totalPiecesPerGuest: 9,
          },
        }
      : undefined;
    const handle = window.setTimeout(() => {
      api
        .calculate({
          guestCount: guestCount || undefined,
          lines,
          guestRulesByGroup,
          charges: [{ name: "Delivery Charge", type: "DELIVERY", value: delivery }],
        })
        .then(setCalc)
        .catch(console.error);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [lines, guestCount, delivery]);

  function setLineQuantity(key: string, raw: number) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key || line.lineMode === "GUEST_BASED") return line;
        const min =
          line.minimumQuantity && line.minimumQuantity > 0 ? line.minimumQuantity : 0.5;
        const qty = Number.isFinite(raw) && raw > 0 ? Math.max(min, raw) : min;
        return { ...line, quantity: qty };
      }),
    );
  }

  function addPackage(pkg: MenuPackage, qty = 1) {
    const amount = Number.isFinite(qty) && qty > 0 ? qty : 1;
    setLines((prev) => {
      const existing = prev.find(
        (l) => l.lineMode === "PACKAGE" && l.menuPackageId === pkg.id,
      );
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key
            ? { ...l, quantity: (l.quantity ?? 0) + amount }
            : l,
        );
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          lineMode: "PACKAGE" as const,
          orderName: pkg.name,
          unit: pkg.unit === "PERSON" ? "Person" : "Box",
          category: catalog?.name,
          unitPriceCents: pkg.unitPriceCents,
          quantity: amount,
          menuPackageId: pkg.id,
          noteComponents: pkg.components.map((c) => ({
            name: c.name,
            quantity: c.quantity ?? undefined,
            unit: c.unit ?? undefined,
            groupName: c.groupName ?? undefined,
          })),
        },
      ];
    });
  }

  function addVariant(
    item: MenuItem & { categoryName: string },
    variant: MenuVariant,
    qty?: number,
  ) {
    const min = variant.minimumQuantity && variant.minimumQuantity > 0 ? variant.minimumQuantity : 0.5;
    const amount = Number.isFinite(qty) && (qty as number) > 0 ? (qty as number) : min;
    setLines((prev) => {
      const existing = prev.find(
        (l) => l.lineMode === "A_LA_CARTE" && l.menuVariantId === variant.id,
      );
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key
            ? { ...l, quantity: (l.quantity ?? 0) + amount }
            : l,
        );
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          lineMode: "A_LA_CARTE" as const,
          orderName: formatOrderName(
            item.categoryName,
            item.name,
            variant.label,
          ),
          unit: variant.unit,
          category: item.categoryName,
          unitPriceCents: variant.unitPriceCents,
          quantity: amount,
          minimumQuantity: variant.minimumQuantity,
          roundingIncrement: variant.roundingIncrement,
          menuItemId: item.id,
          menuVariantId: variant.id,
        },
      ];
    });
  }

  function toggleGuestVariety(
    _item: MenuItem & { categoryName: string },
    variant: MenuVariant,
  ) {
    const variantId = variant.id;
    const finalIds = guestGroupSelected.includes(variantId)
      ? guestGroupSelected.filter((x) => x !== variantId)
      : [...guestGroupSelected, variantId];
    setGuestGroupSelected(finalIds);
    setLines((linesPrev) => {
      const withoutGuest = linesPrev.filter((l) => l.lineMode !== "GUEST_BASED");
      const rebuilt: BuilderLine[] = [];
      for (const fi of filteredItems) {
        for (const v of fi.variants) {
          if (!finalIds.includes(v.id)) continue;
          rebuilt.push({
            key: `guest-${v.id}`,
            lineMode: "GUEST_BASED",
            guestGroupId: "fingerfood",
            orderName: formatOrderName(fi.categoryName, fi.name, v.label),
            unit: "Piece",
            category: fi.categoryName,
            unitPriceCents: Math.max(1, Math.round(v.unitPriceCents / 12)),
            menuItemId: fi.id,
            menuVariantId: v.id,
          });
        }
      }
      return [...withoutGuest, ...rebuilt];
    });
  }

  async function save() {
    setSaving(true);
    try {
      const guestRulesByGroup = lines.some((l) => l.lineMode === "GUEST_BASED")
        ? {
            fingerfood: {
              method: "DISTRIBUTED_ACROSS_VARIETIES" as const,
              totalPiecesPerGuest: 9,
            },
          }
        : undefined;
      const body = {
        clientId: clientId || null,
        customerName,
        phone,
        eventLocation,
        deliveryLocationId: deliveryLocationId || null,
        eventDate: eventDate || null,
        guestCount: guestCount || null,
        lines,
        guestRulesByGroup,
        charges: [{ name: "Delivery Charge", type: "DELIVERY", value: delivery }],
      };
      if (id) {
        await api.updateQuotation(id, body);
        navigate(`/quotations/${id}`);
      } else {
        const created = (await api.createQuotation(body)) as { id: string };
        navigate(`/quotations/${created.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const calcLines = (calc?.lines as Array<Record<string, unknown>>) ?? [];
  const canSave = !saving && !!customerName && lines.length > 0;

  return (
    <div className="stack">
      <div className="sticky-save">
        <div>
          <strong>{id ? "Edit quote" : "New quote"}</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            {lines.length} item{lines.length === 1 ? "" : "s"} ·{" "}
            {money(Number(calc?.grandTotalCents ?? 0))}
          </div>
        </div>
        <button onClick={save} disabled={!canSave}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="panel form-grid">
        <select
          value={clientId}
          onChange={(e) => {
            const nextId = e.target.value;
            setClientId(nextId);
            const c = existingClients.find((x) => x.id === nextId);
            if (c) {
              setCustomerName(c.name);
              setPhone(c.phone ?? "");
            }
          }}
        >
          <option value="">Existing client…</option>
          {existingClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phone ? ` · ${c.phone}` : ""}
              {c.company ? ` · ${c.company}` : ""}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Client name"
          value={customerName}
          onChange={(e) => {
            setCustomerName(e.target.value);
            setClientId("");
          }}
          autoComplete="name"
        />
        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
        />
        <input
          placeholder="Address / venue details"
          value={eventLocation}
          onChange={(e) => setEventLocation(e.target.value)}
          autoComplete="street-address"
        />
        <select
          value={deliveryLocationId}
          onChange={(e) => {
            const nextId = e.target.value;
            setDeliveryLocationId(nextId);
            const loc = deliveryLocations.find((l) => l.id === nextId);
            setDelivery(loc ? loc.deliveryFeeCents / 100 : 0);
          }}
        >
          <option value="">Delivery zone…</option>
          {deliveryLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} — {money(loc.deliveryFeeCents)}
            </option>
          ))}
        </select>
        <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Guests"
          value={guestCount || ""}
          onChange={(e) => setGuestCount(Number(e.target.value) || 0)}
        />
      </div>

      <div className="builder-tabs" role="tablist" aria-label="Builder sections">
        <button
          type="button"
          className={`builder-tab${mobileTab === "menu" ? " active" : ""}`}
          onClick={() => setMobileTab("menu")}
        >
          Menu
        </button>
        <button
          type="button"
          className={`builder-tab${mobileTab === "order" ? " active" : ""}`}
          onClick={() => setMobileTab("order")}
        >
          Order ({lines.length})
        </button>
        <button
          type="button"
          className={`builder-tab${mobileTab === "summary" ? " active" : ""}`}
          onClick={() => setMobileTab("summary")}
        >
          Total
        </button>
      </div>

      <div className="builder">
        <section className={`panel stack builder-pane${mobileTab === "menu" ? " active" : ""}`}>
          <h3 style={{ margin: 0 }}>Fixed menu</h3>
          <select value={catalogCode} onChange={(e) => setCatalogCode(e.target.value)}>
            {catalogs.map((c) => (
              <option key={c.id} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Search menu"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            enterKeyHint="search"
          />
          {filteredPackages.map((pkg) => (
            <MenuAddRow
              key={pkg.id}
              title={pkg.name}
              subtitle={pkg.components.map((c) => c.name).join(" · ")}
              priceLabel={money(pkg.unitPriceCents)}
              unitLabel={pkg.unit === "PERSON" ? "Person" : "Box"}
              defaultQty={1}
              onAdd={(qty) => {
                addPackage(pkg, qty);
                setMobileTab("order");
              }}
              addLabel="Add package"
            />
          ))}
          {filteredItems.map((item) => (
            <div className="menu-item" key={item.id}>
              <div className="muted" style={{ fontSize: 12 }}>
                {item.categoryName}
              </div>
              <strong>{item.name}</strong>
              {item.variants.map((v) => (
                <div key={v.id} style={{ marginTop: 6 }}>
                  <MenuAddRow
                    title={formatOrderName(item.categoryName, item.name, v.label)}
                    subtitle={`${v.label} · ${v.unit} · ${money(v.unitPriceCents)}`}
                    priceLabel=""
                    unitLabel={v.unit}
                    defaultQty={v.minimumQuantity && v.minimumQuantity > 0 ? v.minimumQuantity : 1}
                    onAdd={(qty) => {
                      addVariant(item, v, qty);
                      setMobileTab("order");
                    }}
                    addLabel="Add"
                    extraActions={
                      guestCount > 0 && item.categoryName.toLowerCase().includes("finger") ? (
                        <button
                          className="ghost"
                          onClick={() => toggleGuestVariety(item, v)}
                          title="Add with guest-based quantity"
                        >
                          {guestGroupSelected.includes(v.id) ? "Guest ✓" : "Guest calc"}
                        </button>
                      ) : null
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </section>

        <section className={`panel stack builder-pane${mobileTab === "order" ? " active" : ""}`}>
          <h3 style={{ margin: 0 }}>Selected order</h3>
          {calcLines.length === 0 && <p className="muted">Select items from the fixed menu.</p>}
          {calcLines.map((line) => {
            const key = String(line.key);
            const source = lines.find((l) => l.key === key);
            const editable = source && source.lineMode !== "GUEST_BASED";
            return (
              <div className="line-item" key={key}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{String(line.orderName)}</strong>
                  <button
                    className="ghost"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== key))}
                  >
                    Remove
                  </button>
                </div>
                <div className="row" style={{ alignItems: "center", gap: 8, marginTop: 6 }}>
                  <span className="muted">{String(line.unit)}</span>
                  {editable ? (
                    <>
                      <label className="muted" style={{ fontSize: 12 }}>
                        Qty
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="qty-input"
                        min={
                          source.minimumQuantity && source.minimumQuantity > 0
                            ? source.minimumQuantity
                            : 0.5
                        }
                        step="any"
                        value={source.quantity ?? Number(line.quantity) ?? 1}
                        onChange={(e) => setLineQuantity(key, Number(e.target.value))}
                      />
                    </>
                  ) : (
                    <span className="muted">qty {String(line.quantity)}</span>
                  )}
                  <span className="muted">
                    · {money(Number(line.unitPriceCents))} · {money(Number(line.lineTotalCents))}
                  </span>
                </div>
                {Boolean(line.wasAutoCalculated) && <span className="badge">Auto-calculated</span>}
              </div>
            );
          })}
        </section>

        <section className={`panel stack builder-pane${mobileTab === "summary" ? " active" : ""}`}>
          <h3 style={{ margin: 0 }}>Summary</h3>
          <label className="muted">Delivery ($)</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={delivery}
            onChange={(e) => setDelivery(Number(e.target.value) || 0)}
            title="Auto-filled from delivery zone; you can override"
          />
          <div className="muted" style={{ fontSize: 12 }}>
            {deliveryLocationId
              ? "Filled from selected delivery zone (editable override)."
              : "Select a delivery zone above, or enter a custom fee."}
          </div>
          <div>
            Subtotal: <strong>{money(Number(calc?.subtotalCents ?? 0))}</strong>
          </div>
          <div>
            Delivery:{" "}
            <strong>
              {money(
                Number(
                  (calc?.charges as Array<{ amountCents: number }> | undefined)?.[0]
                    ?.amountCents ?? 0,
                ),
              )}
            </strong>
          </div>
          <div>
            Grand total: <strong>{money(Number(calc?.grandTotalCents ?? 0))}</strong>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Quantities and prices are calculated by the backend.
          </p>
        </section>
      </div>
    </div>
  );
}
