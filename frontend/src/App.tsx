import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/LoginPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const DeliveryLocationsPage = lazy(() => import("./pages/DeliveryLocationsPage"));
const QuotationsPage = lazy(() => import("./pages/QuotationsPage"));
const BuilderPage = lazy(() => import("./pages/BuilderPage"));
const QuotationDetailPage = lazy(() => import("./pages/QuotationDetailPage"));

function PageFallback() {
  return <p className="muted">Loading…</p>;
}

function prefetchHotRoutes() {
  void import("./pages/QuotationsPage");
  void import("./pages/BuilderPage");
  void import("./pages/ClientsPage");
}

export default function App() {
  const { user, setUser } = useAuth();
  useEffect(() => {
    if (!user) return;
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(prefetchHotRoutes, { timeout: 1500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(prefetchHotRoutes, 400);
    return () => window.clearTimeout(t);
  }, [user]);

  if (!user) {
    return <LoginPage onLogin={(u, token) => setUser(u, token)} />;
  }
  return (
    <Shell user={user} onLogout={() => setUser(null)}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/delivery-locations" element={<DeliveryLocationsPage />} />
          <Route path="/quotations" element={<QuotationsPage />} />
          <Route path="/quotations/new" element={<BuilderPage />} />
          <Route path="/quotations/:id" element={<QuotationDetailPage />} />
          <Route path="/quotations/:id/edit" element={<BuilderPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
