"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateClinicAction } from "@/actions/clinic";

interface Props {
  initialData: {
    descripcion: string;
    direccion: string;
    ubicacion_url: string;
    pagina_web: string;
  };
}

type StatusState = { type: "ok" | "error"; message: string } | null;

export default function ClinicForm({ initialData }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setStatus(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const result = await updateClinicAction(form);
    setLoading(false);

    if (result.error) {
      setStatus({ type: "error", message: result.error });
    } else {
      setStatus({ type: "ok", message: "Información guardada correctamente." });
      router.refresh();
    }
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        {/* Descripción — full width */}
        <div className="form-group">
          <label htmlFor="descripcion">Descripción de la clínica</label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={4}
            value={form.descripcion}
            onChange={handleChange}
            placeholder="Descripción general de la clínica…"
          />
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="direccion">Dirección</label>
            <input
              id="direccion"
              name="direccion"
              type="text"
              value={form.direccion}
              onChange={handleChange}
              placeholder="Av. Ejemplo 123, Santiago"
            />
          </div>

          <div className="form-group">
            <label htmlFor="ubicacion_url">URL de ubicación</label>
            <input
              id="ubicacion_url"
              name="ubicacion_url"
              type="url"
              value={form.ubicacion_url}
              onChange={handleChange}
              placeholder="https://maps.google.com/..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="pagina_web">Página web</label>
            <input
              id="pagina_web"
              name="pagina_web"
              type="url"
              value={form.pagina_web}
              onChange={handleChange}
              placeholder="https://clinica.cl"
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Guardando…" : "Guardar"}
          </button>
          {status && (
            <span className={`status-msg ${status.type === "ok" ? "status-ok" : "status-error"}`}>
              {status.message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
