"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const username = form.get("username") as string;
    const password = form.get("password") as string;

    if (!username.trim() || !password) {
      setError("Usuario y contraseña requeridos");
      setLoading(false);
      return;
    }

    const result = await loginAction(username.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push("/general");
    }
  }

  return (
    <div className="login-shell">
      <div className="login-box">
        <div className="login-brand">
          <span className="brand-label">Gacitua Bot</span>
          <h1 className="login-title">Iniciar sesión</h1>
        </div>

        <div className="login-card">
          {error && <p className="login-error">{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="admin"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Ingresando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
