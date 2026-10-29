"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { parseFollowUpInput, parseFollowUpResult, parseFollowUpReschedule } from "./follow-ups";

export type FollowUpActionState = { kind: "idle" | "success" | "error"; message: string };

function refresh(workItemId: string) {
  revalidatePath(`/administracion/${workItemId}`);
  revalidatePath(`/mi-trabajo/${workItemId}`);
  revalidatePath("/seguimientos");
  revalidatePath("/inicio");
}

export async function createAdminFollowUp(_previous: FollowUpActionState, form: FormData): Promise<FollowUpActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  let input;
  try { input = parseFollowUpInput({ workItemId: form.get("workItemId"), scheduledFor: form.get("scheduledFor"), contactName: form.get("contactName"), reason: form.get("reason") }); }
  catch { return { kind: "error", message: "Indica fecha, contacto y motivo válidos." }; }
  const { data, error } = await access.supabase.from("follow_ups").insert({
    work_item_id: input.workItemId, scheduled_for: input.scheduledFor,
    contact_name: input.contactName, reason: input.reason, created_by: access.user.id,
  }).select("id").maybeSingle();
  if (error || !data) return { kind: "error", message: "No se pudo programar el seguimiento." };
  refresh(input.workItemId);
  return { kind: "success", message: "Seguimiento programado." };
}

export async function completeAdminFollowUp(_previous: FollowUpActionState, form: FormData): Promise<FollowUpActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  let input;
  try { input = parseFollowUpResult({ id: form.get("id"), workItemId: form.get("workItemId"), outcome: form.get("outcome") }); }
  catch { return { kind: "error", message: "Escribe un resultado válido." }; }
  const { data, error } = await access.supabase.from("follow_ups")
    .update({ status: "done", outcome: input.outcome }).eq("id", input.id)
    .eq("work_item_id", input.workItemId).eq("status", "pending").select("id").maybeSingle();
  if (error || !data) return { kind: "error", message: "No se pudo registrar el resultado." };
  refresh(input.workItemId);
  return { kind: "success", message: "Resultado guardado." };
}

export async function rescheduleAdminFollowUp(_previous: FollowUpActionState, form: FormData): Promise<FollowUpActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  let input;
  try { input = parseFollowUpReschedule({ id: form.get("id"), workItemId: form.get("workItemId"), scheduledFor: form.get("scheduledFor") }); }
  catch { return { kind: "error", message: "Indica una fecha válida." }; }
  const { data, error } = await access.supabase.from("follow_ups")
    .update({ scheduled_for: input.scheduledFor }).eq("id", input.id)
    .eq("work_item_id", input.workItemId).eq("status", "pending").select("id").maybeSingle();
  if (error || !data) return { kind: "error", message: "No se pudo reprogramar el seguimiento." };
  refresh(input.workItemId);
  return { kind: "success", message: "Seguimiento reprogramado." };
}
