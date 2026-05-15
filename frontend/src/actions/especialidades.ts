"use server";

import { apiFetch, classifyActionError } from "@/lib/api";
import type { Especialidad } from "@/lib/types";

export async function updateEspecialidadAction(
  id: string,
  descripcion: string
): Promise<{ data?: Especialidad; error?: string }> {
  let res: Response | null = null;
  try {
    res = await apiFetch(`/especialidades/${id}`, {
      method: "PUT",
      body: JSON.stringify({ descripcion }),
    });
  } catch {
    const { error } = await classifyActionError(null);
    return { error };
  }

  if (!res.ok) {
    const { error } = await classifyActionError(res);
    return { error };
  }

  return { data: await res.json() };
}
