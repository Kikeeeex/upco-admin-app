"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { parseWorkItemInput, parseWorkItemUpdate } from "./rules";

export type ActionState = { kind: "idle" | "success" | "error"; message: string };

function fields(form: FormData) {
  return {
    title: form.get("title"),
    area: form.get("area"),
    priority: form.get("priority"),
    dueDate: form.get("dueDate") || undefined,
  };
}

export async function createWorkItem(_previous: ActionState, form: FormData): Promise<ActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };

  let input;
  try { input = parseWorkItemInput(fields(form)); }
  catch { return { kind: "error", message: "Revisa el título, el área, la prioridad y la fecha." }; }

  const { error } = await access.supabase.from("work_items").insert({
    organization_id: access.organizationId,
    creator_id: access.user.id,
    type: input.area,
    title: input.title,
    priority: input.priority,
    due_date: input.dueDate ?? null,
  });
  if (error) return { kind: "error", message: "No se pudo guardar la actividad. Inténtalo de nuevo." };

  revalidatePath("/mi-trabajo");
  return { kind: "success", message: "Actividad guardada." };
}

export async function updateWorkItem(_previous: ActionState, form: FormData): Promise<ActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };

  let input;
  try {
    input = parseWorkItemUpdate({ ...fields(form), id: form.get("id"), status: form.get("status") });
  } catch { return { kind: "error", message: "Revisa los datos de la actividad." }; }

  const { data, error } = await access.supabase.from("work_items")
    .update({ title: input.title, priority: input.priority, status: input.status, due_date: input.dueDate ?? null })
    .eq("id", input.id)
    .eq("organization_id", access.organizationId)
    .eq("creator_id", access.user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { kind: "error", message: "No se pudo actualizar la actividad." };

  revalidatePath("/mi-trabajo");
  return { kind: "success", message: "Actividad actualizada." };
}
