"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { parseProcurementRequestInput } from "./request-rules";

export type ProcurementRequestState = { kind: "idle" | "success" | "error"; message: string; href?: string };

export async function createProcurementRequest(_previous: ProcurementRequestState, form: FormData): Promise<ProcurementRequestState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return { kind: "error", message: "Tu sesión no está autorizada." };

  let input;
  try {
    input = parseProcurementRequestInput({
      title: form.get("title"), quantity: form.get("quantity"), unit: form.get("unit"),
      siteId: form.get("siteId"), need: form.get("need"),
      reference: form.get("reference") || undefined, vendorId: form.get("vendorId") || undefined,
    });
  } catch {
    return { kind: "error", message: "Revisa el artículo o servicio, cantidad, unidad, sede y necesidad." };
  }

  const { data: id, error } = await access.supabase.rpc("create_procurement_request", {
    p_organization_id: access.organizationId, p_title: input.title, p_quantity: input.quantity,
    p_unit: input.unit, p_site_id: input.siteId, p_need: input.need,
    p_reference: input.reference ?? null, p_vendor_id: input.vendorId ?? null,
  });
  if (error || typeof id !== "string") {
    return { kind: "error", message: "No se pudo guardar la solicitud. Comprueba que la sede y el proveedor sigan activos." };
  }

  revalidatePath("/procura");
  revalidatePath("/mi-trabajo");
  revalidatePath("/inicio");
  return { kind: "success", message: "Solicitud guardada.", href: `/procura/${id}` };
}
