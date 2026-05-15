"use server";

import { apiFetch, classifyActionError } from "@/lib/api";
import type { FAQ } from "@/lib/types";

export async function createFaqAction(
  question: string,
  answer: string
): Promise<{ data?: FAQ; error?: string }> {
  let res: Response | null = null;
  try {
    res = await apiFetch("/faqs", {
      method: "POST",
      body: JSON.stringify({ question, answer }),
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

export async function deleteFaqAction(id: string): Promise<{ error?: string }> {
  let res: Response | null = null;
  try {
    res = await apiFetch(`/faqs/${id}`, { method: "DELETE" });
  } catch {
    const { error } = await classifyActionError(null);
    return { error };
  }

  if (!res.ok && res.status !== 204) {
    const { error } = await classifyActionError(res);
    return { error };
  }

  return {};
}
