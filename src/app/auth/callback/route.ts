import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/features/auth/supabase-server";
import { getAccessContext } from "@/features/auth/access";
import { SESSION_ACTIVITY_COOKIE, SESSION_STARTED_COOKIE, sessionCookieOptions, sessionStartedCookieOptions } from "@/features/auth/session-policy";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const supabase = await createSupabaseServerClient();
  if (!code || !supabase) return NextResponse.redirect(new URL("/login", request.url));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login", request.url));
  const access = await getAccessContext({ allowFreshSession: true });
  const response = NextResponse.redirect(new URL(access.kind === "allowed" ? "/inicio" : "/acceso-denegado", request.url));
  if (access.kind === "allowed") {
    const now = Date.now();
    const secure = new URL(request.url).protocol === "https:";
    response.cookies.set(SESSION_ACTIVITY_COOKIE, String(now), sessionCookieOptions(secure));
    response.cookies.set(SESSION_STARTED_COOKIE, new Date(now).toISOString(), sessionStartedCookieOptions(secure));
  }
  return response;
}
