import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, serverClient } = vi.hoisted(() => ({ cookieStore: vi.fn(), serverClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookieStore }));
vi.mock("../../src/features/auth/supabase-server", () => ({ createSupabaseServerClient: serverClient }));
vi.mock("../../src/features/auth/authorize", () => ({ getAzureIdentity: () => ({ tenantId: "tenant", subject: "subject" }), authorizeIdentity: () => true }));

import { getAccessContext } from "../../src/features/auth/access";
import { SESSION_ACTIVITY_COOKIE, SESSION_STARTED_COOKIE } from "../../src/features/auth/session-policy";

describe("getAccessContext session limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-10-29T12:30:00.000Z"));
    cookieStore.mockResolvedValue({ get: (name: string) => name === SESSION_ACTIVITY_COOKIE ? { value: String(Date.parse("2026-10-29T12:00:00.000Z")) } : name === SESSION_STARTED_COOKIE ? { value: "2026-10-29T12:00:00.000Z" } : undefined });
    serverClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111", last_sign_in_at: "2026-10-29T12:00:00.000Z" } }, error: null }) },
      from: () => ({ select() { return this; }, eq() { return this; }, async then(resolve: (value: unknown) => void) { resolve({ data: [{ organization_id: "org" }], error: null }); } }),
    });
  });

  afterEach(() => vi.useRealTimers());

  it("keeps a session with recent activity available", async () => {
    vi.setSystemTime(Date.parse("2026-10-29T12:29:59.000Z"));
    expect((await getAccessContext()).kind).toBe("allowed");
  });

  it("rejects an expired session before checking membership", async () => {
    expect((await getAccessContext()).kind).toBe("expired");
  });

  it("allows the fresh OAuth callback to complete before its marker is issued", async () => {
    expect((await getAccessContext({ allowFreshSession: true })).kind).toBe("allowed");
  });

  it("uses the start of this session even after another device signs in", async () => {
    vi.setSystemTime(Date.parse("2026-10-29T20:00:00.000Z"));
    cookieStore.mockResolvedValue({ get: (name: string) => name === SESSION_ACTIVITY_COOKIE ? { value: String(Date.now()) } : name === SESSION_STARTED_COOKIE ? { value: "2026-10-29T12:00:00.000Z" } : undefined });
    expect((await getAccessContext()).kind).toBe("expired");
  });
});
