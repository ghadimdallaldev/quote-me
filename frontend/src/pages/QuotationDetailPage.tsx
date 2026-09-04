import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { money } from "../lib/format";

export default function QuotationDetailPage() {
  const { id } = useParams();
  const [q, setQ] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!id) return;
    const row = await api.getQuotation(id);
    setQ(row as Record<string, unknown>);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [id]);

  async function setStatus(status: string) {
    if (!id) return;
    setBusy(true);
    try {
      await api.setStatus(id, status);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!q) return <p>Loading…</p>;
  const items = (q.items as Array<Record<string, unknown>>) ?? [];
  const status = String(q.status);
  const cancelled = status === "CANCELLED";

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>{String(q.quotationNumber)}</h2>
      <div className="actions-bar">
          {!cancelled && (
            <Link to={`/quotations/${id}/edit`}>
              <button className="secondary" disabled={busy}>
                Edit
              </button>
            </Link>
          )}
          <button onClick={() => id && api.pdf(id)} disabled={busy}>
            Download PDF
          </button>
          <button
            className="secondary"
            onClick={() => id && api.previewHtml(id)}
            disabled={busy}
          >
            Print preview
          </button>
          {!cancelled && (
            <>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setStatus("SENT")}
              >
                Mark sent
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setStatus("APPROVED")}
              >
                Approve
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setStatus("CONFIRMED")}
              >
                Confirm order
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Cancel this order? It will be marked Cancelled and locked from editing.",
                    )
                  ) {
                    return;
                  }
                  await setStatus("CANCELLED");
                }}
              >
                Cancel order
              </button>
            </>
          )}
          {cancelled && (
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Reopen this cancelled order as a Draft?")) return;
                await setStatus("DRAFT");
              }}
            >
              Reopen as draft
            </button>
          )}
      </div>
      {cancelled && (
        <div className="panel" style={{ borderColor: "var(--danger)", background: "#fdf2f0" }}>
          <strong style={{ color: "var(--danger)" }}>Order cancelled</strong>
          <span className="muted"> — editing is locked. Reopen as draft if needed.</span>
        </div>
      )}
      <div className="panel">
        <p>
          <strong>{String(q.customerName)}</strong> · {String(q.phone ?? "")} ·{" "}
          <span className={`badge${cancelled ? " badge-cancelled" : ""}`}>{status}</span>
        </p>
        <p className="muted">{String(q.eventLocation ?? "")}</p>
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Qty</th>
              <th>Unit</th>
              <th>Order</th>
              <th>Price</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={String(item.id)}>
                <td>{String(item.quantity)}</td>
                <td>{String(item.unitSnapshot)}</td>
                <td>{String(item.orderNameSnapshot)}</td>
                <td>{money(Number(item.unitPriceCents))}</td>
                <td>
                  {((item.components as Array<Record<string, unknown>>) ?? []).map((c) => (
                    <div key={String(c.id)}>
                      • {String(c.name)}
                      {c.quantity != null ? ` (${c.quantity})` : ""}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p>
          <strong>Total: {money(Number(q.grandTotalCents))}</strong>
        </p>
      </div>
    </div>
  );
}
