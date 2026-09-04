import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import type { User } from "../api/client";

const nav: Array<{
  to: string;
  label: string;
  end?: boolean;
  icon: string;
  primary?: boolean;
}> = [
  { to: "/", label: "Home", end: true, icon: "⌂" },
  { to: "/quotations", label: "Quotes", icon: "☰" },
  { to: "/quotations/new", label: "New", icon: "+", primary: true },
  { to: "/clients", label: "Clients", icon: "☺" },
  { to: "/delivery-locations", label: "Zones", icon: "◎" },
];

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
      <header className="topbar">
        <div>
          <strong className="brand">quote-me</strong>
          <div className="topbar-sub">{user.name}</div>
        </div>
        <button type="button" className="ghost topbar-logout" onClick={onLogout}>
          Logout
        </button>
      </header>

      <aside className="sidebar">
        <h1>quote-me</h1>
        <p className="sidebar-tagline">Catering quotations</p>
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label === "New" ? "+ New Quotation" : item.label === "Home" ? "Dashboard" : item.label === "Quotes" ? "Quotations" : item.label === "Zones" ? "Delivery zones" : item.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <div className="sidebar-user">{user.name}</div>
        <button type="button" className="secondary" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="content">{children}</main>

      <nav className="bottom-nav" aria-label="Primary">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `bottom-nav-item${isActive ? " active" : ""}${item.primary ? " primary" : ""}`
            }
          >
            <span className="bottom-nav-icon" aria-hidden>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
