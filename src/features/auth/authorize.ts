export type MembershipIdentity = {
  userId: string;
  tenantId: string;
  objectId: string;
  active: boolean;
};

export type AuthorizationInput = {
  authUserId: string;
  provider: string | null;
  tenantId: string | null;
  objectId: string | null;
  allowedTenantId: string | null;
  membership: MembershipIdentity | null;
};

export function authorizeIdentity(input: AuthorizationInput): boolean {
  const { authUserId, provider, tenantId, objectId, allowedTenantId, membership } = input;
  return Boolean(
    provider === "azure" &&
      authUserId &&
      tenantId &&
      objectId &&
      allowedTenantId &&
      membership?.active &&
      tenantId === allowedTenantId &&
      membership.userId === authUserId &&
      membership.tenantId === tenantId &&
      membership.objectId === objectId,
  );
}

type IdentitySource = {
  user_metadata?: unknown;
  identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> }> | null;
};

export function getAzureIdentity(user: IdentitySource): { tenantId: string; objectId: string } | null {
  const azure = user.identities?.find((identity) => identity.provider === "azure");
  const tenantId = azure?.identity_data?.tenantid;
  const objectId = azure?.identity_data?.oid;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof tenantId !== "string" || typeof objectId !== "string" || !uuid.test(tenantId) || !uuid.test(objectId)) {
    return null;
  }
  return { tenantId, objectId };
}
