"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { parseProcurementRequestInput, parseProcurementRequesterUpdate } from "./request-rules";

export type ProcurementRequestState = { kind: "idle" | "success" | "error"; message: string; href?: string };

function requesterFields(form: FormData) {
  return {
    partNumber: form.get("partNumber") || undefined,
    requesterFirstName: form.get("requesterFirstName"),
    requesterLastName: form.get("requesterLastName"),
    requesterArea: form.get("requesterArea"),
  };
}

export async function createProcurementRequest(_previous: ProcurementRequestState, form: FormData): Promise<ProcurementRequestState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };

  let input;
  try {
    input = parseProcurementRequestInput({
      ...requesterFields(form),
      title: form.get("title"), quantity: form.get("quantity"), unit: form.get("unit"),
      siteId: form.get("siteId"), need: form.get("need"),
      reference: form.get("reference") || undefined, vendorId: form.get("vendorId") || undefined,
    });
  } catch {
    return { kind: "error", message: "Revisa el artículo o servicio, cantidad, unidad, sede, necesidad y solicitante." };
  }

  const { data: id, error } = await access.supabase.rpc("create_procurement_request", {
    p_organization_id: access.organizationId, p_title: input.title, p_quantity: input.quantity,
    p_unit: input.unit, p_site_id: input.siteId, p_need: input.need,
    p_reference: input.reference ?? null, p_vendor_id: input.vendorId ?? null,
    p_part_number: input.partNumber ?? null,
    p_requester_first_name: input.requesterFirstName,
    p_requester_last_name: input.requesterLastName,
    p_requester_area: input.requesterArea,
  });
  if (error || typeof id !== "string") {
    return { kind: "error", message: "No se pudo guardar la solicitud. Comprueba que la sede y el proveedor sigan activos." };
  }

  revalidatePath("/procura");
  revalidatePath("/mi-trabajo");
  revalidatePath("/inicio");
  return { kind: "success", message: "Solicitud guardada.", href: `/procura/${id}` };
}

export async function updateProcurementRequester(_previous: ProcurementRequestState, form: FormData): Promise<ProcurementRequestState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };
  let input;
  try { input = parseProcurementRequesterUpdate({ id: form.get("id"), ...requesterFields(form) }); }
  catch { return { kind: "error", message: "Revisa el número de parte y los datos del solicitante." }; }

  const { data: item, error: itemError } = await access.supabase.from("work_items")
    .select("id").eq("id", input.id).eq("organization_id", access.organizationId)
    .eq("creator_id", access.user.id).eq("type", "procurement").is("archived_at", null).maybeSingle();
  if (itemError || !item) return { kind: "error", message: "Esta solicitud no se puede editar." };

  const { data, error } = await access.supabase.from("procurement_details").update({
    part_number: input.partNumber ?? null,
    requester_first_name: input.requesterFirstName,
    requester_last_name: input.requesterLastName,
    requester_area: input.requesterArea,
  }).eq("work_item_id", input.id).select("work_item_id").maybeSingle();
  if (error || !data) return { kind: "error", message: "No se pudieron actualizar los datos del solicitante." };

  revalidatePath("/procura");
  revalidatePath(`/procura/${input.id}`);
  revalidatePath(`/mi-trabajo/${input.id}`);
  return { kind: "success", message: "Datos del solicitante actualizados." };
}
