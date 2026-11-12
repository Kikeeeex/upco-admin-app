"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { createAdministrationServiceClient } from "@/features/administration/documents/service-client";
import { isAdministrationPermission } from "./catalog";

export type AdministrationPermissionsActionState = { kind: "idle" | "success" | "error"; message: string };

export async function replaceMemberAdministrationPermissions(
  _previous: AdministrationPermissionsActionState,
  form: FormData,
): Promise<AdministrationPermissionsActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") {
    return { kind: "error", message: "Solo una persona administradora puede asignar permisos." };
  }
  const userId = form.get("userId");
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return { kind: "error", message: "Selecciona una membresía válida." };
  }
  const requested = form.getAll("permission");
  if (requested.some((permission) => typeof permission !== "string" || !isAdministrationPermission(permission))) {
    return { kind: "error", message: "La selección contiene permisos no reconocidos." };
  }
  const permissions = [...new Set(requested as string[])];
  const service = createAdministrationServiceClient();
  if (!service) return { kind: "error", message: "La gestión de permisos requiere SUPABASE_SERVICE_ROLE_KEY configurada solo en servidor." };
  const { error } = await service.rpc("replace_administration_permissions", {
    p_organization_id: access.organizationId,
    p_target_user_id: userId,
    p_actor_id: access.user.id,
    p_permissions: permissions,
  });
  if (error) return { kind: "error", message: error.code === "P0002" ? "La membresía ya no está activa." : "No se pudieron actualizar los permisos." };
  revalidatePath("/administracion/permisos");
  revalidatePath("/administracion");
  return { kind: "success", message: "Permisos guardados y registrados en auditoría." };
}
