"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateEspecialidadAction } from "@/actions/especialidades";

interface Item {
  id: string;
  especialidad: string;
  descripcion: string;
}

type RowStatus = { type: "ok" | "error"; message: string };

export default function EspecialidadesTable({ items }: { items: Item[] }) {
  const router = useRouter();
  const [descriptions, setDescriptions] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.descripcion]))
  );
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});

  function handleChange(id: string, value: string) {
    setDescriptions((prev) => ({ ...prev, [id]: value }));
    setStatuses((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  async function handleSave(id: string) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    const result = await updateEspecialidadAction(id, descriptions[id] ?? "");
    setLoading((prev) => ({ ...prev, [id]: false }));

    if (result.error) {
      setStatuses((prev) => ({ ...prev, [id]: { type: "error", message: result.error! } }));
    } else {
      setStatuses((prev) => ({ ...prev, [id]: { type: "ok", message: "Guardado" } }));
      router.refresh();
    }
  }

  if (!items.length) {
    return (
      <div className="card">
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
          No hay especialidades. Usa el endpoint <code>/sync/especialidades</code> para importar.
        </p>
      </div>
    );
  }

  return (
    <div className="card table-wrap">
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
        {items.length} especialidad{items.length !== 1 ? "es" : ""} cargada{items.length !== 1 ? "s" : ""}
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: "30%" }}>Especialidad</th>
            <th>Descripción</th>
            <th style={{ width: "120px" }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const st = statuses[item.id];
            const isLoading = loading[item.id] ?? false;
            return (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.especialidad}</td>
                <td>
                  <textarea
                    rows={2}
                    value={descriptions[item.id] ?? ""}
                    onChange={(e) => handleChange(item.id, e.target.value)}
                    placeholder="Descripción…"
                    style={{ width: "100%", minWidth: "180px" }}
                  />
                  {st && (
                    <span className={`status-msg ${st.type === "ok" ? "status-ok" : "status-error"}`}
                      style={{ display: "inline-block", marginTop: "0.25rem" }}>
                      {st.message}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: "0.78rem", padding: "0.35rem 0.85rem" }}
                    disabled={isLoading}
                    onClick={() => handleSave(item.id)}
                  >
                    {isLoading ? "…" : "Guardar"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
