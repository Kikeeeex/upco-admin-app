import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_ACTIVITY_COOKIE, SESSION_STARTED_COOKIE } from "../../src/features/auth/session-policy";

const { createServerClient, signOut } = vi.hoisted(() => ({ createServerClient: vi.fn(), signOut: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/features/auth/routes", async () => import("../../src/features/auth/routes"));
vi.mock("@/features/auth/session-policy", async () => import("../../src/features/auth/session-policy"));

import { proxy } from "../../src/proxy";

const signedInAt = "2026-10-29T12:00:00.000Z";
const signedInMs = Date.parse(signedInAt);
const oldUrl = process.env.SUPABASE_URL;
const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;

function request(path: string, activity?: number, method = "GET") {
  return new NextRequest(`https://upco-admin-app.vercel.app${path}`, {
    method,
    headers: activity === undefined ? {} : { cookie: `upco-admin-session-started=${encodeURIComponent(signedInAt)}; ${SESSION_ACTIVITY_COOKIE}=${activity}` },
  });
}

describe("proxy session deadline", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "public-key";
    vi.useFakeTimers();
    vi.setSystemTime(signedInMs + 10 * 60_000);
    signOut.mockReset();
    createServerClient.mockReset();
    createServerClient.mockImplementation(() => ({
      auth: {
        getUser: async () => ({ data: { user: { last_sign_in_at: signedInAt } }, error: null }),
        signOut,
      },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  });

  it("renews the activity marker on an interactive private POST", async () => {
    const response = await proxy(request("/auth/activity", signedInMs, "POST"));
    expect(response.status).toBe(200);
    expect(response.cookies.get(SESSION_ACTIVITY_COOKIE)?.value).toBe(String(Date.now()));
    expect(response.cookies.get(SESSION_ACTIVITY_COOKIE)?.maxAge).toBe(1800);
    expect(response.cookies.get(SESSION_STARTED_COOKIE)).toBeUndefined();
  });

  it("ends an idle session, including a session without a marker", async () => {
    vi.setSystemTime(signedInMs + 30 * 60_000);
    const response = await proxy(request("/mi-trabajo", signedInMs));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://upco-admin-app.vercel.app/login?expired=1");
    expect(response.cookies.get(SESSION_ACTIVITY_COOKIE)?.maxAge).toBe(0);
    expect(response.cookies.get(SESSION_STARTED_COOKIE)?.maxAge).toBe(0);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });

    signOut.mockClear();
    const missing = await proxy(request("/inicio"));
    expect(missing.status).toBe(307);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("ends the session after eight hours even with recent activity", async () => {
    vi.setSystemTime(signedInMs + 8 * 60 * 60_000);
    const response = await proxy(request("/inicio", Date.now() - 60_000));
    expect(response.headers.get("location")).toBe("https://upco-admin-app.vercel.app/login?expired=1");
  });

  it("does not extend this session when the user signs in on another device", async () => {
    vi.setSystemTime(signedInMs + 8 * 60 * 60_000);
    createServerClient.mockImplementation(() => ({ auth: {
      getUser: async () => ({ data: { user: { last_sign_in_at: new Date(Date.now() - 60_000).toISOString() } }, error: null }),
      signOut,
    } }));
    const response = await proxy(request("/inicio", Date.now() - 60_000));
    expect(response.headers.get("location")).toBe("https://upco-admin-app.vercel.app/login?expired=1");
  });

  it("does not extend activity for GET requests, including Next link prefetch", async () => {
    const response = await proxy(request("/inicio", signedInMs));
    expect(response.status).toBe(200);
    expect(response.cookies.get(SESSION_ACTIVITY_COOKIE)).toBeUndefined();
  });

  it("forwards Supabase's auth-cookie removal on expiry redirects", async () => {
    createServerClient.mockImplementation((_url: string, _key: string, options: { cookies: { setAll: (items: Array<{ name: string; value: string; options: { path: string; maxAge: number } }>) => void } }) => ({
      auth: {
        getUser: async () => ({ data: { user: { last_sign_in_at: signedInAt } }, error: null }),
        signOut: async () => {
          options.cookies.setAll([{ name: "sb-example-auth-token", value: "", options: { path: "/", maxAge: 0 } }]);
          return { error: null };
        },
      },
    }));
    vi.setSystemTime(signedInMs + 30 * 60_000);
    const response = await proxy(request("/inicio", signedInMs));
    expect(response.cookies.get("sb-example-auth-token")?.maxAge).toBe(0);
  });
});
