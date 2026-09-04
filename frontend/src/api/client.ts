/** Empty in production when API serves the SPA from the same origin. */
const API_URL = import.meta.env.VITE_API_URL ?? "";

export type User = { id: string; name: string; email: string; role: string };

type CacheEntry<T> = { at: number; data: T };

const memoryCache = new Map<string, CacheEntry<unknown>>();

function token() {
  return localStorage.getItem("token");
}

function getCached<T>(key: string, ttlMs: number): T | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    memoryCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCached<T>(key: string, data: T) {
  memoryCache.set(key, { at: Date.now(), data });
}

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      err.error?.toString?.() ?? JSON.stringify(err.error) ?? "Request failed",
    );
  }
  if (res.headers.get("content-type")?.includes("application/pdf")) {
    return (await res.blob()) as T;
  }
  return res.json() as Promise<T>;
}

async function cachedGet<T>(path: string, ttlMs: number): Promise<T> {
  const key = path;
  const hit = getCached<T>(key, ttlMs);
  if (hit) return hit;
  const data = await request<T>(path);
  setCached(key, data);
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/api/auth/me"),
  dashboard: () => request<Record<string, unknown>>("/api/dashboard"),
  menu: () => cachedGet<unknown[]>("/api/menu", 10 * 60 * 1000),
  clients: (q = "") =>
    request<unknown[]>(`/api/clients?q=${encodeURIComponent(q)}`),
  createClient: async (body: unknown) => {
    const created = await request("/api/clients", {
      method: "POST",
      body: JSON.stringify(body),
    });
    invalidateApiCache("/api/clients");
    return created;
  },
  quotations: () => request<unknown[]>("/api/quotations"),
  getQuotation: (id: string) => request<unknown>(`/api/quotations/${id}`),
  createQuotation: (body: unknown) =>
    request("/api/quotations", { method: "POST", body: JSON.stringify(body) }),
  updateQuotation: (id: string, body: unknown) =>
    request(`/api/quotations/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  calculate: (body: unknown) =>
    request("/api/quotations/calculate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setStatus: (id: string, status: string) =>
    request(`/api/quotations/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  duplicate: (id: string) =>
    request(`/api/quotations/${id}/duplicate`, { method: "POST", body: "{}" }),
  pdf: async (id: string, fallbackName?: string) => {
    const headers = new Headers();
    const t = token();
    if (t) headers.set("Authorization", `Bearer ${t}`);
    const res = await fetch(`${API_URL}/api/quotations/${id}/pdf`, { headers });
    if (!res.ok) throw new Error("PDF download failed");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plain = disposition.match(/filename="([^"]+)"/i);
    const filename = star
      ? decodeURIComponent(star[1])
      : (plain?.[1] ?? fallbackName ?? `Catering Order.pdf`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  previewHtml: async (id: string) => {
    const headers = new Headers();
    const t = token();
    if (t) headers.set("Authorization", `Bearer ${t}`);
    const res = await fetch(`${API_URL}/api/quotations/${id}/preview`, { headers });
    if (!res.ok) throw new Error("Preview failed");
    const html = await res.text();
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked");
    w.document.write(html);
    w.document.close();
  },
  deliveryLocations: (activeOnly = false) =>
    cachedGet<unknown[]>(
      `/api/delivery-locations${activeOnly ? "?active=1" : ""}`,
      5 * 60 * 1000,
    ),
  createDeliveryLocation: async (body: unknown) => {
    const created = await request("/api/delivery-locations", {
      method: "POST",
      body: JSON.stringify(body),
    });
    invalidateApiCache("/api/delivery-locations");
    return created;
  },
  updateDeliveryLocation: async (id: string, body: unknown) => {
    const updated = await request(`/api/delivery-locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    invalidateApiCache("/api/delivery-locations");
    return updated;
  },
  deleteDeliveryLocation: async (id: string) => {
    const updated = await request(`/api/delivery-locations/${id}`, {
      method: "DELETE",
    });
    invalidateApiCache("/api/delivery-locations");
    return updated;
  },
};
