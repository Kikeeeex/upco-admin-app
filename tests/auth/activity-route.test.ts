import { describe, expect, it, vi } from "vitest";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));

import { POST } from "../../src/app/auth/activity/route";

describe("POST /auth/activity", () => {
  it("keeps an authorized interactive session active", async () => {
    accessContext.mockResolvedValue({ kind: "allowed" });
    const response = await POST();
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a user without an active membership", async () => {
    accessContext.mockResolvedValue({ kind: "denied" });
    expect((await POST()).status).toBe(401);
  });
});
