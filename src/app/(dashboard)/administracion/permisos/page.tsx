import { AdministrationPermissionsForm } from "@/components/administration/permissions-form";
import { getAccessContext } from "@/features/auth/access";
import { redirect } from "next/navigation";
import { ADMINISTRATION_PERMISSIONS, type AdministrationPermission } from "@/features/administration/permissions/catalog";

export default async function AdministrationPermissionsPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") redirect("/administracion/sin-permiso");
  const [membersResult, grantsResult, profilesResult] = await Promise.all([
    access.supabase.from("memberships").select("user_id").eq("organization_id", access.organizationId).eq("active", true).eq("role", "member").order("created_at"),
    access.supabase.from("administration_permissions").select("user_id,permission").eq("organization_id", access.organizationId),
    access.supabase.from("user_profiles").select("user_id,display_name"),
  ]);
  if (membersResult.error || grantsResult.error || profilesResult.error) return <div className="page-content"><h1>Usuarios</h1><p role="alert" className="error-message">No se pudo consultar el directorio de membresías. Revisa que la migración V2.8 esté aplicada.</p></div>;
  const names = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile.display_name]));
  const grants = new Map<string, AdministrationPermission[]>();
  for (const row of grantsResult.data ?? []) {
    const current = grants.get(row.user_id) ?? [];
    if (ADMINISTRATION_PERMISSIONS.includes(row.permission as AdministrationPermission)) current.push(row.permission as AdministrationPermission);
    grants.set(row.user_id, current);
  }
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ACCESOS</span><h1>Usuarios</h1><p>Administra los accesos de miembros activos de esta organización.</p></div>
    <p className="administration-lock-note">Los administradores conservan acceso completo. Emitir, anular, activar configuración e importar documentos reales siguen siendo acciones exclusivas de administradores. Cada cambio queda auditado.</p>
    {membersResult.data?.length ? membersResult.data.map((member) => <AdministrationPermissionsForm
      key={member.user_id} userId={member.user_id} displayName={names.get(member.user_id)?.trim() || "Miembro sin nombre visible"}
      currentPermissions={grants.get(member.user_id) ?? []}
    />) : <section className="work-card"><p className="work-empty">No hay miembros activos para asignar.</p></section>}
  </div>;
}
