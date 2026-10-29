import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/features/auth/supabase-server";
import { SESSION_ACTIVITY_COOKIE, SESSION_STARTED_COOKIE, sessionCookieOptions, sessionStartedCookieOptions } from "@/features/auth/session-policy";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  const expired = new URL(request.url).searchParams.get("expired") === "1";
  const response = NextResponse.redirect(new URL(expired ? "/login?expired=1" : "/login", request.url), { status: 303 });
  response.cookies.set(SESSION_ACTIVITY_COOKIE, "", { ...sessionCookieOptions(new URL(request.url).protocol === "https:"), maxAge: 0 });
  response.cookies.set(SESSION_STARTED_COOKIE, "", { ...sessionStartedCookieOptions(new URL(request.url).protocol === "https:"), maxAge: 0 });
  return response;
}
