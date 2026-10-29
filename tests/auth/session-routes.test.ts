import { describe, expect, it, vi } from "vitest";
import { SESSION_ACTIVITY_COOKIE, SESSION_STARTED_COOKIE } from "../../src/features/auth/session-policy";

const { serverClient, accessContext, signOut } = vi.hoisted(() => ({ serverClient: vi.fn(), accessContext: vi.fn(), signOut: vi.fn() }));
vi.mock("@/features/auth/supabase-server", () => ({ createSupabaseServerClient: serverClient }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
vi.mock("@/features/auth/session-policy", async () => import("../../src/features/auth/session-policy"));

import { GET as callback } from "../../src/app/auth/callback/route";
import { POST as signout } from "../../src/app/auth/signout/route";

describe("session routes", () => {
  it("starts a 30-minute activity marker after successful Microsoft login", async () => {
    serverClient.mockResolvedValue({ auth: { exchangeCodeForSession: async () => ({ error: null }) } });
    accessContext.mockResolvedValue({ kind: "allowed" });
    const response = await callback(new Request("https://upco-admin-app.vercel.app/auth/callback?code=valid"));
    expect(response.headers.get("location")).toBe("https://upco-admin-app.vercel.app/inicio");
    expect(response.cookies.get(SESSION_ACTIVITY_COOKIE)?.maxAge).toBe(1800);
    expect(response.cookies.get(SESSION_ACTIVITY_COOKIE)?.httpOnly).toBe(true);
    expect(response.cookies.get(SESSION_STARTED_COOKIE)?.maxAge).toBe(28800);
  });

  it("clears the activity marker when signing out", async () => {
    signOut.mockResolvedValue({ error: null });
    serverClient.mockResolvedValue({ auth: { signOut } });
    const response = await signout(new Request("https://upco-admin-app.vercel.app/auth/signout", { method: "POST" }));
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(303);
    expect(response.cookies.get(SESSION_ACTIVITY_COOKIE)?.maxAge).toBe(0);
    expect(response.cookies.get(SESSION_STARTED_COOKIE)?.maxAge).toBe(0);
  });

  it("explains automatic expiry on the login URL", async () => {
    serverClient.mockResolvedValue({ auth: { signOut } });
    const response = await signout(new Request("https://upco-admin-app.vercel.app/auth/signout?expired=1", { method: "POST" }));
    expect(response.headers.get("location")).toBe("https://upco-admin-app.vercel.app/login?expired=1");
  });
});
