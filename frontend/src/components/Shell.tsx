import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import type { User } from "../api/client";

export function Shell({
  user,
  onLogout,
  children,
}: {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>quote-me</h1>
        <p className="muted" style={{ color: "#9fc4bf", fontSize: 12, margin: "0 0 0.75rem" }}>
          Catering quotations
        </p>
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/quotations">Quotations</NavLink>
        <NavLink to="/quotations/new">+ New Quotation</NavLink>
        <NavLink to="/clients">Clients</NavLink>
        <NavLink to="/delivery-locations">Delivery zones</NavLink>
        <div style={{ flex: 1 }} />
        <div className="muted" style={{ color: "#9fc4bf", fontSize: 12 }}>
          {user.name}
        </div>
        <button className="secondary" onClick={onLogout}>
          Logout
        </button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
