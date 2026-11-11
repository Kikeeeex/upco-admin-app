import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${sessionCookieOptions(request).secure ? "; Secure" : ""}`);
  return response;
}
