import { redirect } from "next/navigation";
import { apiFetchSafe } from "@/lib/api";
import type { Especialidad } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Nav from "@/components/Nav";
import EspecialidadesTable from "@/components/especialidades/EspecialidadesTable";
import ErrorBanner from "@/components/ErrorBanner";

export default async function EspecialidadesPage() {
  const result = await apiFetchSafe<Especialidad[]>("/especialidades");

  if (!result.ok) {
    if (result.errorType === "unauthorized") redirect("/login");
    return (
      <div className="page-shell">
        <PageHeader title="Especialidades" />
        <Nav />
        <ErrorBanner errorType={result.errorType} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title="Especialidades" />
      <Nav />
      <EspecialidadesTable items={result.data} />
    </div>
  );
}
