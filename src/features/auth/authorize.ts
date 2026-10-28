export type MembershipIdentity = {
  userId: string;
  tenantId: string;
  subject: string;
  active: boolean;
};

export type AuthorizationInput = {
  authUserId: string;
  provider: string | null;
  tenantId: string | null;
  subject: string | null;
  allowedTenantId: string | null;
  membership: MembershipIdentity | null;
};

export function authorizeIdentity(input: AuthorizationInput): boolean {
  const { authUserId, provider, tenantId, subject, allowedTenantId, membership } = input;
  return Boolean(
    provider === "azure" &&
      authUserId &&
      tenantId &&
      subject &&
      allowedTenantId &&
      membership?.active &&
      tenantId === allowedTenantId &&
      membership.userId === authUserId &&
      membership.tenantId === tenantId &&
      membership.subject === subject,
  );
}

type IdentitySource = {
  user_metadata?: unknown;
  identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> }> | null;
};

export function getAzureIdentity(user: IdentitySource): { tenantId: string; subject: string } | null {
  const azure = user.identities?.find((identity) => identity.provider === "azure");
  const claims = azure?.identity_data?.custom_claims;
  const tenantId = claims && typeof claims === "object" && !Array.isArray(claims)
    ? (claims as Record<string, unknown>).tid : null;
  const subject = azure?.identity_data?.sub;
  const providerId = azure?.identity_data?.provider_id;
  const issuer = azure?.identity_data?.iss;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof tenantId !== "string" || !uuid.test(tenantId) ||
      typeof subject !== "string" || subject.length < 16 || subject.length > 255 ||
      subject !== providerId || issuer !== `https://login.microsoftonline.com/${tenantId}/v2.0`) {
    return null;
  }
  return { tenantId, subject };
}
