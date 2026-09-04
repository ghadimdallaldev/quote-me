import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { money } from "../lib/format";

type ClientRow = {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  stats: {
    quotationCount: number;
    totalValueCents: number;
    confirmedCount: number;
    approvedCount: number;
    draftCount: number;
    sentCount: number;
    lastQuotationAt: string | null;
    lastQuotationNumber: string | null;
    lastEventDate: string | null;
    byStatus: Record<string, number>;
  };
  recentQuotations: Array<{
    id: string;
    quotationNumber: string;
    status: string;
    grandTotalCents: number;
    eventDate: string | null;
    createdAt: string;
  }>;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "" });

  async function refresh(query = q) {
    setClients((await api.clients(query)) as ClientRow[]);
  }
  useEffect(() => {
    refresh().catch(console.error);
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    await api.createClient(form);
    setForm({ name: "", company: "", phone: "", email: "" });
    await refresh();
  }

  const totals = clients.reduce(
    (acc, c) => {
      acc.clients += 1;
      acc.quotes += c.stats.quotationCount;
      acc.value += c.stats.totalValueCents;
      return acc;
    },
    { clients: 0, quotes: 0, value: 0 },
  );
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>Clients</h2>
      <p className="muted">
        Clients are created automatically when you save a quotation. Search often-used contacts and
        review their quotation history here.
      </p>
      <div className="grid-cards">
        <div className="card">
          <span className="muted">Clients</span>
          <strong>{totals.clients}</strong>
        </div>
        <div className="card">
          <span className="muted">Quotations</span>
          <strong>{totals.quotes}</strong>
        </div>
        <div className="card">
          <span className="muted">Total value</span>
          <strong>{money(totals.value)}</strong>
        </div>
      </div>
      <div className="row">
        <input
          style={{ maxWidth: 320 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, company…"
        />
        <button className="secondary" onClick={() => refresh()}>
          Search
        </button>
      </div>
      <form className="panel row" onSubmit={create}>
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Company"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
        />
        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <button type="submit">Add client</button>
      </form>
      <div className="panel" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Quotes</th>
              <th>Value</th>
              <th>Confirmed</th>
              <th>Last quote</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr
                key={c.id}
                style={{ background: selectedId === c.id ? "var(--accent-soft)" : undefined }}
              >
                <td>
                  <strong>{c.name}</strong>
                  {c.company ? (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.company}
                    </div>
                  ) : null}
                </td>
                <td>{c.phone || "—"}</td>
                <td>{c.stats.quotationCount}</td>
                <td>{money(c.stats.totalValueCents)}</td>
                <td>{c.stats.confirmedCount}</td>
                <td>
                  {c.stats.lastQuotationNumber ?? "—"}
                  {c.stats.lastQuotationAt ? (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {new Date(c.stats.lastQuotationAt).toLocaleDateString("en-GB")}
                    </div>
                  ) : null}
                </td>
                <td>
                  <button
                    className="ghost"
                    onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                  >
                    {selectedId === c.id ? "Hide" : "History"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>{selected.name}</h3>
            <Link to="/quotations/new">
              <button className="secondary">New quotation</button>
            </Link>
          </div>
          <div className="muted">
            {selected.phone || "No phone"} · {selected.email || "No email"} ·{" "}
            {selected.address || "No address"}
          </div>
          <div className="row">
            <span className="badge">Draft {selected.stats.draftCount}</span>
            <span className="badge">Sent {selected.stats.sentCount}</span>
            <span className="badge">Approved {selected.stats.approvedCount}</span>
            <span className="badge">Confirmed {selected.stats.confirmedCount}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Status</th>
                <th>Event</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {selected.recentQuotations.map((quote) => (
                <tr key={quote.id}>
                  <td>{quote.quotationNumber}</td>
                  <td>
                    <span className="badge">{quote.status}</span>
                  </td>
                  <td>
                    {quote.eventDate
                      ? new Date(quote.eventDate).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                  <td>{money(quote.grandTotalCents)}</td>
                  <td>
                    <Link to={`/quotations/${quote.id}`}>
                      <button className="ghost">Open</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
