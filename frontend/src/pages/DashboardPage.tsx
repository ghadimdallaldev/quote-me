import { useEffect, useState } from "react";
import { api } from "../api/client";
import { money } from "../lib/format";

export default function DashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api.dashboard().then(setData).catch(console.error);
  }, []);
  if (!data) return <p>Loading…</p>;
  const byStatus = (data.byStatus ?? {}) as Record<string, number>;
  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>Operations Dashboard</h2>
      <div className="grid-cards">
        <div className="card">
          <span className="muted">Total</span>
          <strong>{String(data.totalQuotations ?? 0)}</strong>
        </div>
        <div className="card">
          <span className="muted">Draft</span>
          <strong>{byStatus.DRAFT ?? 0}</strong>
        </div>
        <div className="card">
          <span className="muted">Sent</span>
          <strong>{byStatus.SENT ?? 0}</strong>
        </div>
        <div className="card">
          <span className="muted">Approved</span>
          <strong>{byStatus.APPROVED ?? 0}</strong>
        </div>
        <div className="card">
          <span className="muted">Confirmed</span>
          <strong>{byStatus.CONFIRMED ?? 0}</strong>
        </div>
        <div className="card">
          <span className="muted">Cancelled</span>
          <strong>{byStatus.CANCELLED ?? 0}</strong>
        </div>
        <div className="card">
          <span className="muted">Value</span>
          <strong>{money(Number(data.totalQuotationValueCents ?? 0))}</strong>
        </div>
      </div>
    </div>
  );
}
