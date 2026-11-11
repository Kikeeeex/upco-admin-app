"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { parseFiscalVendorInput, parseFiscalVendorUpdate, type FiscalVendorInput } from "./rules";

export type FiscalVendorActionState = { kind: "idle" | "success" | "error"; message: string };

const value = (form: FormData, key: string) => form.get(key);
function fields(form: FormData): FiscalVendorInput {
  return parseFiscalVendorInput({
    legalName: value(form, "legalName"), taxIdentifier: value(form, "taxIdentifier"),
    taxAddress: value(form, "taxAddress"), taxpayerType: value(form, "taxpayerType"),
    personType: value(form, "personType"), residency: value(form, "residency"),
    contactName: value(form, "contactName"), contactPhone: value(form, "contactPhone"),
    contactEmail: value(form, "contactEmail"), ivaRetentionRate: value(form, "ivaRetentionRate"),
    fiscalMachineNumbers: value(form, "fiscalMachineNumbers"), active: value(form, "active") === "on",
    reviewState: value(form, "reviewState"), reviewNotes: value(form, "reviewNotes"),
  });
}

function row(input: FiscalVendorInput) {
  return {
    legal_name: input.legalName, tax_identifier: input.taxIdentifier, tax_address: input.taxAddress,
    taxpayer_type: input.taxpayerType ?? null, person_type: input.personType, residency: input.residency ?? null,
    contact_name: input.contactName ?? null, contact_phone: input.contactPhone ?? null,
    contact_email: input.contactEmail ?? null, iva_retention_rate: input.ivaRetentionRate,
    fiscal_machine_numbers: input.fiscalMachineNumbers ?? null, active: input.active,
    review_state: input.reviewState, review_notes: input.reviewNotes ?? null,
  };
}

export async function createFiscalVendor(_previous: FiscalVendorActionState, form: FormData): Promise<FiscalVendorActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") return { kind: "error", message: "No tienes permiso para administrar proveedores fiscales." };
  let input: FiscalVendorInput;
  try { input = fields(form); }
  catch { return { kind: "error", message: "Revisa los datos del proveedor y el RIF." }; }
  const { error } = await access.supabase.from("fiscal_vendors").insert({
    ...row(input), organization_id: access.organizationId, created_by: access.user.id,
  });
  if (error) return { kind: "error", message: error.code === "23505" ? "Ya existe un proveedor fiscal con ese RIF." : "No se pudo guardar el proveedor fiscal." };
  revalidatePath("/administracion/proveedores");
  return { kind: "success", message: "Proveedor fiscal guardado." };
}

export async function updateFiscalVendor(_previous: FiscalVendorActionState, form: FormData): Promise<FiscalVendorActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") return { kind: "error", message: "No tienes permiso para administrar proveedores fiscales." };
  let input;
  try {
    input = parseFiscalVendorUpdate({ ...fields(form), id: value(form, "id") });
  } catch { return { kind: "error", message: "Revisa los datos del proveedor y el RIF." }; }
  const { data, error } = await access.supabase.from("fiscal_vendors").update(row(input))
    .eq("id", input.id).eq("organization_id", access.organizationId).eq("created_by", access.user.id)
    .select("id").maybeSingle();
  if (error) return { kind: "error", message: error.code === "23505" ? "Ya existe un proveedor fiscal con ese RIF." : "No se pudo actualizar el proveedor fiscal." };
  if (!data) return { kind: "error", message: "No se encontró el proveedor fiscal autorizado." };
  revalidatePath("/administracion/proveedores");
  revalidatePath(`/administracion/proveedores/${input.id}`);
  return { kind: "success", message: "Proveedor fiscal actualizado." };
}
