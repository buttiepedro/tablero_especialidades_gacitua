import { redirect } from "next/navigation";
import { apiFetchSafe } from "@/lib/api";
import type { FAQ } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Nav from "@/components/Nav";
import FaqForm from "@/components/faqs/FaqForm";
import FaqList from "@/components/faqs/FaqList";
import ErrorBanner from "@/components/ErrorBanner";

export default async function FaqsPage() {
  const result = await apiFetchSafe<FAQ[]>("/faqs");

  if (!result.ok) {
    if (result.errorType === "unauthorized") redirect("/login");
    return (
      <div className="page-shell">
        <PageHeader title="Preguntas frecuentes" />
        <Nav />
        <ErrorBanner errorType={result.errorType} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title="Preguntas frecuentes" />
      <Nav />
      <FaqForm />
      <FaqList faqs={result.data} />
    </div>
  );
}
