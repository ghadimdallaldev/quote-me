import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { money } from "../lib/format";

type Loc = {
  id: string;
  name: string;
  deliveryFeeCents: number;
  notes?: string | null;
  isActive: boolean;
  displayOrder: number;
};

export default function DeliveryLocationsPage() {
  const [rows, setRows] = useState<Loc[]>([]);
  const [form, setForm] = useState({ name: "", fee: "0", notes: "" });
  async function refresh() {
    setRows((await api.deliveryLocations()) as Loc[]);
  }
  useEffect(() => {
    refresh().catch(console.error);
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    await api.createDeliveryLocation({
      name: form.name,
      deliveryFeeCents: Math.round(Number(form.fee) * 100),
      notes: form.notes || null,
    });
    setForm({ name: "", fee: "0", notes: "" });
    await refresh();
  }
  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>Delivery / transportation by location</h2>
      <p className="muted">
        Add delivery zones with fixed fees. In a quotation, picking a zone auto-fills the delivery
        charge.
      </p>
      <form className="panel row" onSubmit={create}>
        <input
          required
          placeholder="Location name (e.g. Achrafieh)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          required
          type="number"
          min={0}
          step="0.01"
          placeholder="Fee $"
          value={form.fee}
          onChange={(e) => setForm({ ...form, fee: e.target.value })}
          style={{ maxWidth: 140 }}
        />
        <input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button type="submit">Add location</button>
      </form>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Delivery fee</th>
              <th>Notes</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((loc) => (
              <tr key={loc.id}>
                <td>{loc.name}</td>
                <td>{money(loc.deliveryFeeCents)}</td>
                <td className="muted">{loc.notes}</td>
                <td>
                  <span className="badge">{loc.isActive ? "Active" : "Inactive"}</span>
                </td>
                <td className="row">
                  <button
                    className="ghost"
                    onClick={async () => {
                      const fee = window.prompt(
                        "Delivery fee in $",
                        String(loc.deliveryFeeCents / 100),
                      );
                      if (fee == null) return;
                      await api.updateDeliveryLocation(loc.id, {
                        deliveryFeeCents: Math.round(Number(fee) * 100),
                      });
                      await refresh();
                    }}
                  >
                    Edit fee
                  </button>
                  {loc.isActive && (
                    <button
                      className="ghost"
                      onClick={async () => {
                        await api.deleteDeliveryLocation(loc.id);
                        await refresh();
                      }}
                    >
                      Deactivate
                    </button>
                  )}
                  {!loc.isActive && (
                    <button
                      className="ghost"
                      onClick={async () => {
                        await api.updateDeliveryLocation(loc.id, { isActive: true });
                        await refresh();
                      }}
                    >
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
