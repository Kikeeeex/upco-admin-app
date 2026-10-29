import { describe, expect, it } from "vitest";
import { SESSION_IDLE_MS, SESSION_MAX_MS, sessionExpiryReason } from "../../src/features/auth/session-policy";

const signedIn = "2026-10-29T12:00:00.000Z";
const start = Date.parse(signedIn);

describe("sessionExpiryReason", () => {
  it("keeps an active session immediately before both deadlines", () => {
    expect(sessionExpiryReason(signedIn, String(start + SESSION_MAX_MS - SESSION_IDLE_MS), start + SESSION_MAX_MS - 1)).toBeNull();
  });

  it("expires after 30 minutes without activity", () => {
    expect(sessionExpiryReason(signedIn, String(start), start + SESSION_IDLE_MS - 1)).toBeNull();
    expect(sessionExpiryReason(signedIn, String(start), start + SESSION_IDLE_MS)).toBe("idle");
  });

  it("expires after eight hours even with recent activity", () => {
    expect(sessionExpiryReason(signedIn, String(start + SESSION_MAX_MS - 60_000), start + SESSION_MAX_MS)).toBe("maximum");
  });

  it("rejects missing or invalid timestamps, including a future activity marker", () => {
    expect(sessionExpiryReason(signedIn, undefined, start + 1000)).toBe("idle");
    expect(sessionExpiryReason(signedIn, "invalid", start + 1000)).toBe("idle");
    expect(sessionExpiryReason(signedIn, String(start + 120_000), start)).toBe("idle");
    expect(sessionExpiryReason(undefined, String(start), start + 1000)).toBe("maximum");
  });
});
