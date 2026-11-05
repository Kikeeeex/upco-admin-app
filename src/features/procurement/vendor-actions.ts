"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { parseVendorInput, parseVendorUpdate, vendorArchiveCutoff } from "./vendor-rules";
import { z } from "zod";

export type VendorActionState = { kind: "idle" | "success" | "error"; message: string };

function fields(form: FormData) {
  return {
    name: form.get("name"), country: form.get("country") || undefined,
    taxIdentifier: form.get("taxIdentifier") || undefined, phone: form.get("phone") || undefined,
    email: form.get("email") || undefined, salesArea: form.get("salesArea") || undefined,
    contactPerson: form.get("contactPerson") || undefined, website: form.get("website") || undefined,
    city: form.get("city") || undefined, productsServicesDetail: form.get("productsServicesDetail") || undefined,
  };
}

export async function createVendor(_previous: VendorActionState, form: FormData): Promise<VendorActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  let input;
  try { input = parseVendorInput(fields(form)); }
  catch { return { kind: "error", message: "Revisa los datos del proveedor y el formato del correo electrónico." }; }
  const { data, error } = await access.supabase.from("vendors").insert({
    organization_id: access.organizationId, created_by: access.user.id, name: input.name,
    country: input.country ?? null, tax_identifier: input.taxIdentifier ?? null,
    phone: input.phone ?? null, email: input.email ?? null, sales_area: input.salesArea ?? null,
    contact_name: input.contactPerson ?? null, website: input.website ?? null, city: input.city ?? null,
    products_services_detail: input.productsServicesDetail ?? null,
  }).select("id").maybeSingle();
  if (error?.code === "23505") return { kind: "error", message: "Ya existe un proveedor con esos datos de identificación." };
  if (error || !data) return { kind: "error", message: "No se pudo guardar el proveedor." };
  revalidatePath("/procura");
  return { kind: "success", message: "Proveedor guardado." };
}

export async function updateVendor(_previous: VendorActionState, form: FormData): Promise<VendorActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  let input;
  try { input = parseVendorUpdate({ ...fields(form), id: form.get("id") }); }
  catch { return { kind: "error", message: "Revisa los datos del proveedor y el formato del correo electrónico." }; }
  const { data, error } = await access.supabase.from("vendors").update({
    name: input.name, country: input.country ?? null, tax_identifier: input.taxIdentifier ?? null,
    phone: input.phone ?? null, email: input.email ?? null, sales_area: input.salesArea ?? null,
    contact_name: input.contactPerson ?? null, website: input.website ?? null, city: input.city ?? null,
    products_services_detail: input.productsServicesDetail ?? null,
  }).eq("id", input.id).eq("organization_id", access.organizationId)
    .eq("created_by", access.user.id).is("archived_at", null).select("id").maybeSingle();
  if (error?.code === "23505") return { kind: "error", message: "Ya existe un proveedor con esos datos de identificación." };
  if (error || !data) return { kind: "error", message: "No se pudo actualizar el proveedor." };
  revalidatePath("/procura");
  return { kind: "success", message: "Proveedor actualizado." };
}

async function changeArchiveState(form: FormData, restoring: boolean): Promise<VendorActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  const parsed = z.uuid().safeParse(form.get("id"));
  if (!parsed.success) return { kind: "error", message: "Proveedor no válido." };
  let query = access.supabase.from("vendors").update({ archived_at: restoring ? null : new Date().toISOString() })
    .eq("id", parsed.data).eq("organization_id", access.organizationId).eq("created_by", access.user.id);
  query = restoring ? query.not("archived_at", "is", null).gte("archived_at", vendorArchiveCutoff()) : query.is("archived_at", null);
  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) return { kind: "error", message: restoring ? "No se pudo restaurar el proveedor." : "No se pudo eliminar el proveedor." };
  revalidatePath("/procura");
  return { kind: "success", message: restoring ? "Proveedor restaurado." : "Proveedor eliminado del catálogo activo." };
}

export async function archiveVendor(_previous: VendorActionState, form: FormData): Promise<VendorActionState> {
  return changeArchiveState(form, false);
}

export async function restoreVendor(_previous: VendorActionState, form: FormData): Promise<VendorActionState> {
  return changeArchiveState(form, true);
}

export async function deleteVendorPermanently(_previous: VendorActionState, form: FormData): Promise<VendorActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  const parsed = z.uuid().safeParse(form.get("id"));
  if (!parsed.success) return { kind: "error", message: "Proveedor no válido." };
  const { data, error } = await access.supabase.from("vendors").delete()
    .eq("id", parsed.data).eq("organization_id", access.organizationId).eq("created_by", access.user.id)
    .not("archived_at", "is", null).gte("archived_at", vendorArchiveCutoff())
    .select("id").maybeSingle();
  if (error?.code === "23503") return { kind: "error", message: "El proveedor tiene registros asociados y no se puede eliminar permanentemente." };
  if (error || !data) return { kind: "error", message: "No se pudo eliminar permanentemente el proveedor." };
  revalidatePath("/procura");
  return { kind: "success", message: "Proveedor eliminado permanentemente." };
}
