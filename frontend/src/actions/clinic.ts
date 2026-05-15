"use server";

import { apiFetch, classifyActionError } from "@/lib/api";
import type { ClinicInfo } from "@/lib/types";

export async function updateClinicAction(
  data: Partial<ClinicInfo>
): Promise<{ data?: ClinicInfo; error?: string }> {
  let res: Response | null = null;
  try {
    res = await apiFetch("/clinic", {
      method: "PUT",
      body: JSON.stringify(data),
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
