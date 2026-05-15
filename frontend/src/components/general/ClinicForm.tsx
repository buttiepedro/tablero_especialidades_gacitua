"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateClinicAction } from "@/actions/clinic";
import type { ClinicInfo, Horarios, HorarioDia } from "@/lib/types";
import TimeInput from "@/components/ui/TimeInput";

interface Props {
  initialData: ClinicInfo;
}

type StatusState = { type: "ok" | "error"; message: string } | null;

const DIAS: { key: keyof Horarios; label: string }[] = [
  { key: "lunes",     label: "Lunes"     },
  { key: "martes",    label: "Martes"    },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves",    label: "Jueves"    },
  { key: "viernes",   label: "Viernes"   },
  { key: "sabado",    label: "Sábado"    },
  { key: "domingo",   label: "Domingo"   },
];

const DEFAULT_DIA: HorarioDia = {
  abierto:      false,
  inicio:       "09:00",
  cierre:       "18:00",
  divide_turno: false,
  tarde_inicio: null,
  tarde_cierre: null,
};

function buildHorarios(initial?: Partial<Horarios>): Horarios {
  const base: Horarios = {
    lunes:     { ...DEFAULT_DIA },
    martes:    { ...DEFAULT_DIA },
    miercoles: { ...DEFAULT_DIA },
    jueves:    { ...DEFAULT_DIA },
    viernes:   { ...DEFAULT_DIA },
    sabado:    { ...DEFAULT_DIA },
    domingo:   { ...DEFAULT_DIA },
  };
  if (!initial) return base;
  for (const { key } of DIAS) {
    if (initial[key]) base[key] = { ...DEFAULT_DIA, ...initial[key] };
  }
  return base;
}

export default function ClinicForm({ initialData }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    descripcion:   initialData.descripcion,
    direccion:     initialData.direccion,
    ubicacion_url: initialData.ubicacion_url,
    pagina_web:    initialData.pagina_web,
  });
  const [horarios, setHorarios] = useState<Horarios>(() =>
    buildHorarios(initialData.horarios)
  );
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState<StatusState>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setStatus(null);
  }

  function handleToggleDay(day: keyof Horarios) {
    const idx = DIAS.findIndex((d) => d.key === day);
    setHorarios((prev) => {
      const current = prev[day];
      if (current.abierto) {
        return { ...prev, [day]: { ...current, abierto: false } };
      }
      // Copy config from nearest previous open day
      let tpl: { inicio: string | null; cierre: string | null; divide_turno: boolean; tarde_inicio: string | null; tarde_cierre: string | null } = {
        inicio:       "09:00",
        cierre:       "18:00",
        divide_turno: false,
        tarde_inicio: null,
        tarde_cierre: null,
      };
      for (let i = idx - 1; i >= 0; i--) {
        const p = prev[DIAS[i].key];
        if (p.abierto) {
          tpl = {
            inicio:       p.inicio,
            cierre:       p.cierre,
            divide_turno: p.divide_turno,
            tarde_inicio: p.tarde_inicio,
            tarde_cierre: p.tarde_cierre,
          };
          break;
        }
      }
      return { ...prev, [day]: { ...current, abierto: true, ...tpl } };
    });
    setStatus(null);
  }

  function handleTimeChange(
    day:   keyof Horarios,
    field: "inicio" | "cierre" | "tarde_inicio" | "tarde_cierre",
    value: string
  ) {
    setHorarios((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value || null },
    }));
    setStatus(null);
  }

  function handleToggleTurno(day: keyof Horarios) {
    setHorarios((prev) => {
      const cur = prev[day];
      if (cur.divide_turno) {
        return { ...prev, [day]: { ...cur, divide_turno: false, tarde_inicio: null, tarde_cierre: null } };
      }
      return {
        ...prev,
        [day]: {
          ...cur,
          divide_turno: true,
          cierre:       "13:00",
          tarde_inicio: "14:00",
          tarde_cierre: cur.cierre ?? "18:00",
        },
      };
    });
    setStatus(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const result = await updateClinicAction({ ...form, horarios });
    setLoading(false);
    if (result.error) {
      setStatus({ type: "error", message: result.error });
    } else {
      setStatus({ type: "ok", message: "Información guardada correctamente." });
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card">
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
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", fontWeight: 600 }}>
          Horarios de atención
        </h3>

        <div className="horarios-list">
          {DIAS.map(({ key, label }) => {
            const dia = horarios[key];
            const hasTarde = dia.abierto && dia.divide_turno;

            return (
              <div
                key={key}
                className={[
                  "horario-block",
                  dia.abierto  ? "horario-block--open"  : "",
                  hasTarde     ? "horario-block--split"  : "",
                ].filter(Boolean).join(" ")}
              >
                {/* ── Main row ───────────────────────── */}
                <div className="horario-main-row">
                  <button
                    type="button"
                    className={`day-toggle-pill${dia.abierto ? " day-toggle-pill--active" : ""}`}
                    onClick={() => handleToggleDay(key)}
                    aria-pressed={dia.abierto}
                  >
                    {label}
                  </button>

                  {dia.abierto ? (
                    <>
                      <div className="horario-times-group">
                        {dia.divide_turno && (
                          <span className="horario-turno-label">Mañana</span>
                        )}
                        <div className="horario-time-range">
                          <TimeInput
                            value={dia.inicio}
                            onChange={(v) => handleTimeChange(key, "inicio", v ?? "")}
                          />
                          <span className="horario-time-sep">—</span>
                          <TimeInput
                            value={dia.cierre}
                            onChange={(v) => handleTimeChange(key, "cierre", v ?? "")}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`btn-split-turno${dia.divide_turno ? " btn-split-turno--active" : ""}`}
                        onClick={() => handleToggleTurno(key)}
                        title={dia.divide_turno ? "Quitar turno tarde" : "Agregar turno tarde"}
                      >
                        {dia.divide_turno ? "× Tarde" : "+ Tarde"}
                      </button>
                    </>
                  ) : (
                    <span className="horario-closed-label">Cerrado</span>
                  )}
                </div>

                {/* ── Tarde row ──────────────────────── */}
                {hasTarde && (
                  <div className="horario-tarde-row">
                    <div className="horario-tarde-spacer" />
                    <span className="horario-turno-label">Tarde</span>
                    <div className="horario-time-range">
                      <TimeInput
                        value={dia.tarde_inicio}
                        onChange={(v) => handleTimeChange(key, "tarde_inicio", v ?? "")}
                      />
                      <span className="horario-time-sep">—</span>
                      <TimeInput
                        value={dia.tarde_cierre}
                        onChange={(v) => handleTimeChange(key, "tarde_cierre", v ?? "")}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
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
  );
}
