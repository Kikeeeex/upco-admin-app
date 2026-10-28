import { describe, expect, it } from "vitest";
import { authorizeIdentity, getAzureIdentity } from "../../src/features/auth/authorize";

const tenantId = "11111111-1111-4111-8111-111111111111";
const subject = "AzByCxDwEvFuGtHsIrJqKpLoMnNmOlPkQjRiShTgUfV";
const approved = {
  authUserId: "22222222-2222-4222-8222-222222222222",
  provider: "azure",
  tenantId,
  subject,
  allowedTenantId: tenantId,
  membership: {
    userId: "22222222-2222-4222-8222-222222222222",
    tenantId,
    subject,
    active: true,
  },
};

describe("authorizeIdentity", () => {
  it("accepts matching Azure tenant, subject and active membership", () => {
    expect(authorizeIdentity(approved)).toBe(true);
  });

  it("denies a different tenant", () => {
    expect(authorizeIdentity({ ...approved, tenantId: "44444444-4444-4444-8444-444444444444" })).toBe(false);
  });

  it("denies an inactive membership", () => {
    expect(authorizeIdentity({ ...approved, membership: { ...approved.membership, active: false } })).toBe(false);
  });

  it("denies a different or missing provider subject", () => {
    expect(authorizeIdentity({ ...approved, subject: "another-subject" })).toBe(false);
    expect(authorizeIdentity({ ...approved, subject: null })).toBe(false);
    expect(authorizeIdentity({ ...approved, provider: "email" })).toBe(false);
  });
});

describe("getAzureIdentity", () => {
  it("reads signed Azure claims from the Supabase provider identity", () => {
    expect(getAzureIdentity({ identities: [{
      provider: "azure",
      identity_data: {
        iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        sub: subject,
        provider_id: subject,
        custom_claims: { tid: tenantId, email: "sample@example.test" },
      },
    }] })).toEqual({ tenantId, subject });
  });

  it("ignores editable user metadata and identities from other providers", () => {
    expect(getAzureIdentity({
      user_metadata: { custom_claims: { tid: tenantId }, sub: subject },
      identities: [{ provider: "email", identity_data: {} }],
    })).toBeNull();
  });

  it("rejects a mismatched issuer or provider subject", () => {
    const identity = {
      provider: "azure",
      identity_data: {
        iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        sub: subject,
        provider_id: subject,
        custom_claims: { tid: tenantId },
      },
    };
    expect(getAzureIdentity({ identities: [{ ...identity, identity_data: {
      ...identity.identity_data,
      iss: "https://login.microsoftonline.com/44444444-4444-4444-8444-444444444444/v2.0",
    } }] })).toBeNull();
    expect(getAzureIdentity({ identities: [{ ...identity, identity_data: {
      ...identity.identity_data,
      provider_id: "different-subject",
    } }] })).toBeNull();
  });
});
