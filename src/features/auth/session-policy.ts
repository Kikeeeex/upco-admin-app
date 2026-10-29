export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_MAX_MS = 8 * 60 * 60 * 1000;
export const SESSION_ACTIVITY_COOKIE = "upco-admin-last-activity";
export const SESSION_STARTED_COOKIE = "upco-admin-session-started";

export function sessionCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: SESSION_IDLE_MS / 1000 };
}

export function sessionStartedCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: SESSION_MAX_MS / 1000 };
}

export function sessionExpiryReason(
  signedInAt: string | undefined,
  lastActivityAt: string | undefined,
  nowMs: number,
): "idle" | "maximum" | null {
  const signedInMs = signedInAt ? Date.parse(signedInAt) : NaN;
  if (!Number.isFinite(signedInMs) || signedInMs > nowMs + 60_000 || nowMs - signedInMs >= SESSION_MAX_MS) return "maximum";

  const lastActivityMs = lastActivityAt ? Number(lastActivityAt) : NaN;
  if (!Number.isSafeInteger(lastActivityMs) || lastActivityMs <= 0 || lastActivityMs > nowMs + 60_000 || nowMs - lastActivityMs >= SESSION_IDLE_MS) return "idle";
  return null;
}
