"use server";

import { cookies } from "next/headers";

const BASE = process.env.INTERNAL_API_URL ?? "http://localhost:8000";
const EXPIRY_DAYS = 3;

export async function loginAction(
  username: string,
  password: string
): Promise<{ error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.API_KEY ?? "",
      },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
  } catch {
    return { error: "No se pudo conectar con el servidor" };
  }

  if (res.status === 503) return { error: "Base de datos no disponible" };

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: data.detail ?? "Credenciales inválidas" };
  }

  const data = await res.json();
  const store = await cookies();
  store.set("access_token", data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: EXPIRY_DAYS * 86400,
    path: "/",
  });

  return {};
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete("access_token");
}
