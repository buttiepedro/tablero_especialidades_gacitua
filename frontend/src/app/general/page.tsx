import { redirect } from "next/navigation";
import { apiFetchSafe } from "@/lib/api";
import type { ClinicInfo } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Nav from "@/components/Nav";
import ClinicForm from "@/components/general/ClinicForm";
import ErrorBanner from "@/components/ErrorBanner";

export default async function GeneralPage() {
  const result = await apiFetchSafe<ClinicInfo>("/clinic");

  if (!result.ok) {
    if (result.errorType === "unauthorized") redirect("/login");
    return (
      <div className="page-shell">
        <PageHeader title="Información general" />
        <Nav />
        <ErrorBanner errorType={result.errorType} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title="Información general" />
      <Nav />
      <ClinicForm initialData={result.data} />
    </div>
  );
}
