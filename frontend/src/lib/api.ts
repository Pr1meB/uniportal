/**
 * Thin fetch wrapper for the Django API (same origin via Next rewrites).
 *  - sends the session cookie automatically (same-origin)
 *  - adds X-CSRFToken on unsafe methods, fetching the cookie first if needed
 *  - normalises errors into ApiError {status, detail, errors}
 *  - retries safe requests when the connection drops or the gateway hiccups
 */

export class ApiError extends Error {
  status: number;
  code: string;
  errors: Record<string, unknown>;

  constructor(status: number, detail: string, code = "error", errors: Record<string, unknown> = {}) {
    super(detail);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

async function csrfToken(): Promise<string> {
  let token = readCookie("csrftoken");
  if (!token) {
    await fetch("/api/auth/csrf/", { credentials: "same-origin" });
    token = readCookie("csrftoken");
  }
  return token ?? "";
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function buildPath(path: string, query?: Query) {
  const [base, existing] = path.split("?");
  const clean = base.endsWith("/") ? base : base + "/";
  const params = new URLSearchParams(existing);
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const qs = params.toString();
  return `/api${clean.startsWith("/") ? clean : "/" + clean}${qs ? "?" + qs : ""}`;
}

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
const RETRY_STATUSES = [502, 503, 504];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; query?: Query; retry?: boolean } = {},
): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (!SAFE_METHODS.includes(method)) headers["X-CSRFToken"] = await csrfToken();

  // Only repeat requests that are safe to send twice: reads, or callers that opt in.
  const attempts = (opts.retry ?? SAFE_METHODS.includes(method)) ? 3 : 1;
  let res: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(400 * 2 ** (i - 1));
    try {
      res = await fetch(buildPath(path, opts.query), {
        method,
        headers,
        credentials: "same-origin",
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      if (i === attempts - 1) throw err;
      continue;
    }
    if (!RETRY_STATUSES.includes(res.status)) break;
  }
  res = res!;

  if (res.status === 204) return null as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = (data ?? {}) as { detail?: string; code?: string; errors?: Record<string, unknown> };
    const fallback =
      res.status >= 500 ? "The server ran into a problem. Please try again." : `Request failed (${res.status}).`;
    throw new ApiError(res.status, d.detail || fallback, d.code, d.errors ?? {});
  }
  return data as T;
}

export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

/** First error message for a field from an ApiError, for inline form hints. */
export function fieldError(err: unknown, ...path: string[]): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  let node: unknown = err.errors;
  for (const key of path) {
    if (node && typeof node === "object" && key in (node as object)) node = (node as Record<string, unknown>)[key];
    else return undefined;
  }
  if (Array.isArray(node)) return String(node[0]);
  return typeof node === "string" ? node : undefined;
}
