import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSqlite } from "@/db";
import { parsePermissions, type Permission, type UserRole } from "@/lib/permissions";

export const SESSION_COOKIE = "upco_session";
const SESSION_HOURS = 24;

export type AppUser = { id: number; username: string; role: UserRole; permissions: Permission[] };

export function passwordHash(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = Buffer.from(passwordHash(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  getSqlite().prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(tokenHash, userId, expiresAt);
  return { token, expiresAt };
}

export function deleteSession(token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  getSqlite().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash);
}

export async function currentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const row = getSqlite().prepare(`SELECT u.id, u.username, u.role, u.permissions FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`).get(hash, new Date().toISOString()) as
      { id: number; username: string; role: string; permissions: string } | undefined;
  return row ? { id: row.id, username: row.username, role: row.role === "master" ? "master" : "operator", permissions: parsePermissions(row.permissions) } : null;
}

export async function requireUser(): Promise<AppUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export function sessionCookieOptions(request: Request) {
  const secure = request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
  return { httpOnly: true, sameSite: "strict" as const, secure, path: "/", maxAge: SESSION_HOURS * 60 * 60 };
}
