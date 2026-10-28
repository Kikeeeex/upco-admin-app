import { describe, expect, it } from "vitest";
import { authorizeIdentity, getAzureIdentity } from "../../src/features/auth/authorize";

const approved = {
  authUserId: "22222222-2222-4222-8222-222222222222",
  provider: "azure",
  tenantId: "11111111-1111-4111-8111-111111111111",
  objectId: "33333333-3333-4333-8333-333333333333",
  allowedTenantId: "11111111-1111-4111-8111-111111111111",
  membership: {
    userId: "22222222-2222-4222-8222-222222222222",
    tenantId: "11111111-1111-4111-8111-111111111111",
    objectId: "33333333-3333-4333-8333-333333333333",
    active: true,
  },
};

describe("authorizeIdentity", () => {
  it("accepts matching Azure identity, tenant and active membership", () => {
    expect(authorizeIdentity(approved)).toBe(true);
  });

  it("denies a different tenant", () => {
    expect(authorizeIdentity({ ...approved, tenantId: "44444444-4444-4444-8444-444444444444" })).toBe(false);
  });

  it("denies an inactive membership", () => {
    expect(authorizeIdentity({ ...approved, membership: { ...approved.membership, active: false } })).toBe(false);
  });

  it("denies missing provider identity even when the email might match", () => {
    expect(authorizeIdentity({ ...approved, objectId: null })).toBe(false);
    expect(authorizeIdentity({ ...approved, provider: "email" })).toBe(false);
  });
});

describe("getAzureIdentity", () => {
  it("uses provider identity data and ignores editable user metadata", () => {
    expect(getAzureIdentity({
      user_metadata: { tenantid: approved.tenantId, oid: approved.objectId },
      identities: [{ provider: "email", identity_data: {} }],
    })).toBeNull();
    expect(getAzureIdentity({ identities: [{
      provider: "azure",
      identity_data: { tenantid: approved.tenantId, oid: approved.objectId },
    }] })).toEqual({ tenantId: approved.tenantId, objectId: approved.objectId });
  });
});
