"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteFaqAction } from "@/actions/faqs";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export default function FaqList({ faqs }: { faqs: FAQ[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  async function handleDelete(id: string) {
    setDeleting((prev) => ({ ...prev, [id]: true }));
    const result = await deleteFaqAction(id);
    setDeleting((prev) => ({ ...prev, [id]: false }));
    if (!result.error) router.refresh();
  }

  if (!faqs.length) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginTop: "1.5rem" }}>
        Todavía no hay preguntas frecuentes.
      </p>
    );
  }

  return (
    <div className="faq-list">
      {faqs.map((faq) => (
        <div key={faq.id} className="faq-card">
          <div className="faq-content">
            <p className="faq-question">{faq.question}</p>
            <p className="faq-answer">{faq.answer}</p>
          </div>
          <button
            className="btn btn-danger"
            disabled={deleting[faq.id]}
            onClick={() => handleDelete(faq.id)}
            aria-label="Eliminar FAQ"
          >
            {deleting[faq.id] ? "…" : "Eliminar"}
          </button>
        </div>
      ))}
    </div>
  );
}
