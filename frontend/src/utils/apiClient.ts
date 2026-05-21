// ─────────────────────────────────────────────────────────────────────────────
// API client — thin fetch wrapper that attaches the JWT from localStorage
// ─────────────────────────────────────────────────────────────────────────────

const BASE = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:3543";

const getToken = (): string => localStorage.getItem("vlab_token") ?? "";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${getToken()}`,
      ...(init.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return data as T;
}

export const apiGet    = <T>(path: string)                   => request<T>(path);
export const apiPost   = <T>(path: string, body: unknown)    => request<T>(path, { method: "POST",   body: JSON.stringify(body) });
export const apiPatch  = <T>(path: string, body?: unknown)   => request<T>(path, { method: "PATCH",  body: body ? JSON.stringify(body) : undefined });
export const apiDelete = <T>(path: string)                   => request<T>(path, { method: "DELETE" });
