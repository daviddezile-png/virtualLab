// ─────────────────────────────────────────────────────────────────────────────
// API client — thin fetch wrapper that attaches the JWT from localStorage
// ─────────────────────────────────────────────────────────────────────────────

// In dev the Vite proxy forwards /api → http://localhost:3543 automatically.
// In production set VITE_API_URL to your server's full origin (e.g. https://api.example.com).
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const getToken = (): string => localStorage.getItem("vlab_token") ?? "";

// Plain-language fallback for each HTTP status, so the interface never shows a
// raw code like "HTTP 500". A specific message from the server (data.error) is
// always preferred over these generic ones.
const friendlyStatus = (status: number, retryAfter?: string | null): string => {
  switch (status) {
    case 400: return "Something in the request wasn't right. Please check your input and try again.";
    case 401: return "Your session has expired. Please sign in again.";
    case 403: return "You don't have permission to do that.";
    case 404: return "We couldn't find what you were looking for.";
    case 408: return "The request took too long. Please try again.";
    case 409: return "That conflicts with something that already exists.";
    case 429: return `Too many requests — please wait ${retryAfter ? `${retryAfter}s` : "a moment"} and try again.`;
    case 503: return "The service is temporarily unavailable. Please try again shortly.";
    default:
      if (status >= 500) return "Something went wrong on our end. Please try again in a moment.";
      return "Something went wrong. Please try again.";
  }
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${getToken()}`,
        ...(init.headers ?? {}),
      },
    });
  } catch {
    // fetch only rejects on network-level failures (offline, server down, CORS).
    throw new Error("Can't reach the server. Please check your connection and try again.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const serverMsg = (data as { error?: string }).error;
    throw new Error(serverMsg ?? friendlyStatus(res.status, res.headers.get("Retry-After")));
  }

  return data as T;
}

export interface HealthResult {
  ok: boolean;                 // server reachable and reporting status "OK"
  database: string;            // "connected" | "disconnected" | "connecting" | … | "unknown"
}

// Liveness probe. Hits the server's /health (which lives outside /api), using
// the same BASE as every other call so it works through the dev proxy and in
// production. Reports both overall health and the live DB connection state.
export const checkHealth = async (): Promise<HealthResult> => {
  try {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) return { ok: false, database: "unknown" };
    const data = await res.json();
    return { ok: data.status === "OK", database: data.database ?? "unknown" };
  } catch {
    return { ok: false, database: "unknown" };
  }
};

export const apiGet    = <T>(path: string)                   => request<T>(path);
export const apiPost   = <T>(path: string, body: unknown)    => request<T>(path, { method: "POST",   body: JSON.stringify(body) });
export const apiPatch  = <T>(path: string, body?: unknown)   => request<T>(path, { method: "PATCH",  body: body ? JSON.stringify(body) : undefined });
export const apiDelete = <T>(path: string)                   => request<T>(path, { method: "DELETE" });
