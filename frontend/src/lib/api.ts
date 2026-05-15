import { cookies } from "next/headers";
import type { ApiErrorType, SafeResult } from "@/lib/types";

const BASE = process.env.INTERNAL_API_URL ?? "http://localhost:8000";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const store = await cookies();
  const token = store.get("access_token")?.value;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Cookie"] = `access_token=${token}`;
  }

  headers["X-API-Key"] = process.env.API_KEY ?? "";

  return fetch(`${BASE}${path}`, { ...options, headers, cache: "no-store" });
}

export async function apiFetchSafe<T>(
  path: string,
  options: RequestInit = {}
): Promise<SafeResult<T>> {
  let res: Response;
  try {
    res = await apiFetch(path, options);
  } catch {
    return { ok: false, errorType: "no_backend" };
  }

  if (res.status === 401) return { ok: false, errorType: "unauthorized" };
  if (res.status === 503) return { ok: false, errorType: "db_unavailable" };
  if (!res.ok) return { ok: false, errorType: "server_error" };

  const data: T = await res.json();
  return { ok: true, data };
}

export async function classifyActionError(
  res: Response | null
): Promise<{ error: string; errorType: ApiErrorType }> {
  if (!res) return { error: "No se pudo conectar con el servidor", errorType: "no_backend" };
  if (res.status === 503) return { error: "Base de datos no disponible", errorType: "db_unavailable" };
  const body = await res.json().catch(() => ({}));
  return {
    error: body.detail ?? "Error interno del servidor",
    errorType: "server_error",
  };
}
