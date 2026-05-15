"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createFaqAction } from "@/actions/faqs";

type StatusState = { type: "ok" | "error"; message: string } | null;

export default function FaqForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    const data = new FormData(e.currentTarget);
    const question = (data.get("question") as string).trim();
    const answer = (data.get("answer") as string).trim();

    if (!question || !answer) {
      setStatus({ type: "error", message: "Pregunta y respuesta requeridas" });
      return;
    }

    setLoading(true);
    const result = await createFaqAction(question, answer);
    setLoading(false);

    if (result.error) {
      setStatus({ type: "error", message: result.error });
    } else {
      setStatus({ type: "ok", message: "FAQ guardada correctamente." });
      formRef.current?.reset();
      router.refresh();
    }
  }

  return (
    <div className="card">
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="faq-question">Pregunta</label>
          <input
            id="faq-question"
            name="question"
            type="text"
            placeholder="¿Cuál es el horario de atención?"
            onChange={() => setStatus(null)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: "1.25rem" }}>
          <label htmlFor="faq-answer">Respuesta</label>
          <textarea
            id="faq-answer"
            name="answer"
            rows={3}
            placeholder="Atendemos de lunes a viernes…"
            onChange={() => setStatus(null)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Guardando…" : "Guardar FAQ"}
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
