import { getSqlite } from "@/db";
import { createSession, sessionCookieOptions, verifyPassword, SESSION_COOKIE } from "@/lib/auth";

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!username || !password) return Response.json({ error: "Ingrese usuario y contraseña." }, { status: 400 });
  // En LAN el cliente puede falsificar X-Forwarded-For. Limite los intentos por cuenta.
  const key = username;
  const now = Date.now();
  const previous = attempts.get(key);
  if (previous && previous.resetAt > now && previous.count >= 6) {
    return Response.json({ error: "Demasiados intentos. Espere 15 minutos." }, { status: 429 });
  }
  const row = getSqlite().prepare("SELECT id, password_hash, salt FROM users WHERE username = ? AND active = 1").get(username) as
    { id: number; password_hash: string; salt: string } | undefined;
  const valid = row && verifyPassword(password, row.salt, row.password_hash);
  if (!valid) {
    const count = previous && previous.resetAt > now ? previous.count + 1 : 1;
    attempts.set(key, { count, resetAt: now + 15 * 60_000 });
    return Response.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }
  attempts.delete(key);
  const session = createSession(row.id);
  const response = Response.json({ ok: true, username });
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${session.token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict${sessionCookieOptions(request).secure ? "; Secure" : ""}`);
  return response;
}
