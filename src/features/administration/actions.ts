"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { parseAdminMatterInput, parseAdminDetailsUpdate } from "./rules";

export type AdminActionState = { kind: "idle" | "success" | "error"; message: string; href?: string };

function detailFields(form: FormData) {
  return {
    procedureType: form.get("procedureType"),
    counterpartName: form.get("counterpartName"),
    reference: form.get("reference") || undefined,
    documentStatus: form.get("documentStatus"),
    documentReference: form.get("documentReference") || undefined,
    documentUrl: form.get("documentUrl") || undefined,
  };
}

export async function createAdminMatter(_previous: AdminActionState, form: FormData): Promise<AdminActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };

  let input;
  try {
    input = parseAdminMatterInput({
      ...detailFields(form), title: form.get("title"), commitmentDate: form.get("commitmentDate") || undefined,
      description: form.get("description") || undefined, siteId: form.get("siteId") || undefined,
    });
  } catch {
    return { kind: "error", message: "Revisa el asunto, tipo, contraparte, fecha y datos documentales." };
  }

  const { data: id, error } = await access.supabase.rpc("create_admin_matter", {
    p_organization_id: access.organizationId,
    p_title: input.title,
    p_procedure_type: input.procedureType,
    p_counterpart_name: input.counterpartName,
    p_reference: input.reference ?? null,
    p_commitment_date: input.commitmentDate ?? null,
    p_document_status: input.documentStatus,
    p_document_reference: input.documentReference ?? null,
    p_document_url: input.documentUrl ?? null,
    p_description: input.description ?? null,
    p_site_id: input.siteId ?? null,
  });
  if (error || typeof id !== "string") return { kind: "error", message: "No se pudo guardar la gestión. Inténtalo de nuevo." };

  revalidatePath("/administracion");
  revalidatePath("/mi-trabajo");
  revalidatePath("/inicio");
  return { kind: "success", message: "Gestión guardada.", href: `/administracion/${id}` };
}

export async function updateAdminDetails(_previous: AdminActionState, form: FormData): Promise<AdminActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };

  let input;
  try { input = parseAdminDetailsUpdate({ ...detailFields(form), id: form.get("id") }); }
  catch { return { kind: "error", message: "Revisa los datos documentales de la gestión." }; }

  const { data: item, error: itemError } = await access.supabase.from("work_items")
    .select("id").eq("id", input.id).eq("organization_id", access.organizationId)
    .eq("creator_id", access.user.id).eq("type", "administration").is("archived_at", null).maybeSingle();
  if (itemError || !item) return { kind: "error", message: "Esta gestión no se puede editar." };

  const { data, error } = await access.supabase.from("admin_details").update({
    procedure_type: input.procedureType,
    counterpart_name: input.counterpartName,
    reference: input.reference ?? null,
    document_status: input.documentStatus,
    document_reference: input.documentReference ?? null,
    document_url: input.documentUrl ?? null,
  }).eq("work_item_id", input.id).select("work_item_id").maybeSingle();
  if (error || !data) return { kind: "error", message: "No se pudo actualizar la documentación." };

  revalidatePath("/administracion");
  revalidatePath(`/administracion/${input.id}`);
  revalidatePath(`/mi-trabajo/${input.id}`);
  return { kind: "success", message: "Datos documentales actualizados." };
}
