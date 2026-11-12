import "server-only";
import { cookies } from "next/headers";
import { authorizeIdentity, getAzureIdentity } from "./authorize";
import { createSupabaseServerClient } from "./supabase-server";
import { SESSION_ACTIVITY_COOKIE, SESSION_STARTED_COOKIE, sessionExpiryReason } from "./session-policy";

export async function getAccessContext(options: { allowFreshSession?: boolean } = {}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { kind: "unconfigured" as const };

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { kind: "anonymous" as const };
  const cookieStore = await cookies();
  const marker = cookieStore.get(SESSION_ACTIVITY_COOKIE)?.value;
  const sessionStartedAt = cookieStore.get(SESSION_STARTED_COOKIE)?.value;
  if (!options.allowFreshSession && sessionExpiryReason(sessionStartedAt, marker, Date.now())) return { kind: "expired" as const };

  const identity = getAzureIdentity(user);
  if (!identity) return { kind: "denied" as const };

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("user_id, organization_id, entra_tenant_id, entra_subject, active, role")
    .eq("user_id", user.id)
    .eq("active", true);
  if (membershipError || !memberships) return { kind: "denied" as const };

  const membership = memberships.find((row) => authorizeIdentity({
    authUserId: user.id,
    provider: "azure",
    tenantId: identity.tenantId,
    subject: identity.subject,
    allowedTenantId: process.env.ENTRA_TENANT_ID ?? null,
    membership: {
      userId: row.user_id,
      tenantId: row.entra_tenant_id,
      subject: row.entra_subject,
      active: row.active,
    },
  }));

  if (!membership) return { kind: "denied" as const };
  const permissionResult = membership.role === "admin"
    ? { data: [], error: null }
    : await supabase.from("administration_permissions").select("permission")
      .eq("organization_id", membership.organization_id).eq("user_id", user.id);
  if (permissionResult.error || !permissionResult.data) return { kind: "denied" as const };
  return {
    kind: "allowed" as const, supabase, user, organizationId: membership.organization_id,
    role: membership.role, permissions: permissionResult.data.map((row) => row.permission),
    sessionStartedAt: sessionStartedAt ?? "",
  };
}
