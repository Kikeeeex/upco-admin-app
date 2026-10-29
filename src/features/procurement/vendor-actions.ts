"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { parseVendorInput, parseVendorUpdate } from "./vendor-rules";

export type VendorActionState = { kind: "idle" | "success" | "error"; message: string };

function fields(form: FormData) {
  return {
    name: form.get("name"), contactName: form.get("contactName") || undefined,
    email: form.get("email") || undefined, phone: form.get("phone") || undefined,
    notes: form.get("notes") || undefined,
  };
}

export async function createVendor(_previous: VendorActionState, form: FormData): Promise<VendorActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  let input;
  try { input = parseVendorInput(fields(form)); }
  catch { return { kind: "error", message: "Revisa el nombre, correo y datos de contacto del proveedor." }; }
  const { data, error } = await access.supabase.from("vendors").insert({
    organization_id: access.organizationId, created_by: access.user.id, name: input.name,
    contact_name: input.contactName ?? null, email: input.email ?? null,
    phone: input.phone ?? null, notes: input.notes ?? null,
  }).select("id").maybeSingle();
  if (error?.code === "23505") return { kind: "error", message: "Ya existe un proveedor con ese nombre." };
  if (error || !data) return { kind: "error", message: "No se pudo guardar el proveedor." };
  revalidatePath("/procura");
  return { kind: "success", message: "Proveedor guardado." };
}

export async function updateVendor(_previous: VendorActionState, form: FormData): Promise<VendorActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  let input;
  try { input = parseVendorUpdate({ ...fields(form), id: form.get("id") }); }
  catch { return { kind: "error", message: "Revisa el nombre, correo y datos de contacto del proveedor." }; }
  const { data, error } = await access.supabase.from("vendors").update({
    name: input.name, contact_name: input.contactName ?? null, email: input.email ?? null,
    phone: input.phone ?? null, notes: input.notes ?? null,
  }).eq("id", input.id).eq("organization_id", access.organizationId)
    .eq("created_by", access.user.id).select("id").maybeSingle();
  if (error?.code === "23505") return { kind: "error", message: "Ya existe un proveedor con ese nombre." };
  if (error || !data) return { kind: "error", message: "No se pudo actualizar el proveedor." };
  revalidatePath("/procura");
  return { kind: "success", message: "Proveedor actualizado." };
}
