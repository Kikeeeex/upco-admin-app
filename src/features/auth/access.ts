import "server-only";
import { authorizeIdentity, getAzureIdentity } from "./authorize";
import { createSupabaseServerClient } from "./supabase-server";

export async function getAccessContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { kind: "unconfigured" as const };

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { kind: "anonymous" as const };

  const identity = getAzureIdentity(user);
  if (!identity) return { kind: "denied" as const };

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("user_id, organization_id, entra_tenant_id, entra_object_id, active")
    .eq("user_id", user.id)
    .eq("active", true);
  if (membershipError || !memberships) return { kind: "denied" as const };

  const membership = memberships.find((row) => authorizeIdentity({
    authUserId: user.id,
    provider: "azure",
    tenantId: identity.tenantId,
    objectId: identity.objectId,
    allowedTenantId: process.env.ENTRA_TENANT_ID ?? null,
    membership: {
      userId: row.user_id,
      tenantId: row.entra_tenant_id,
      objectId: row.entra_object_id,
      active: row.active,
    },
  }));

  if (!membership) return { kind: "denied" as const };
  return { kind: "allowed" as const, supabase, user, organizationId: membership.organization_id };
}
