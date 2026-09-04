import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { money } from "../lib/format";

export default function QuotationsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  async function refresh() {
    setRows((await api.quotations()) as Array<Record<string, unknown>>);
  }
  useEffect(() => {
    refresh().catch(console.error);
  }, []);
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Quotations</h2>
        <Link to="/quotations/new">
          <button>+ New Quotation</button>
        </Link>
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Client</th>
              <th>Status</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={String(q.id)}>
                <td>{String(q.quotationNumber)}</td>
                <td>{String(q.customerName)}</td>
                <td>
                  <span className="badge">{String(q.status)}</span>
                </td>
                <td>{money(Number(q.grandTotalCents))}</td>
                <td className="row">
                  <Link to={`/quotations/${q.id}`}>
                    <button className="ghost">Open</button>
                  </Link>
                  <button className="ghost" onClick={() => api.pdf(String(q.id))}>
                    PDF
                  </button>
                  <button
                    className="ghost"
                    onClick={async () => {
                      await api.duplicate(String(q.id));
                      await refresh();
                    }}
                  >
                    Duplicate
                  </button>
                  {String(q.status) !== "CANCELLED" && (
                    <button
                      className="ghost"
                      style={{ color: "var(--danger)" }}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Cancel order ${String(q.quotationNumber)}?`,
                          )
                        ) {
                          return;
                        }
                        await api.setStatus(String(q.id), "CANCELLED");
                        await refresh();
                      }}
                    >
                      Cancel
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
