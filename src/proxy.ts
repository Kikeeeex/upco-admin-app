import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath } from "@/features/auth/routes";
import { SESSION_ACTIVITY_COOKIE, SESSION_STARTED_COOKIE, sessionCookieOptions, sessionStartedCookieOptions, sessionExpiryReason } from "@/features/auth/session-policy";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const protectedPage = isProtectedPath(request.nextUrl.pathname);
  if (!url || !key) return protectedPage ? NextResponse.redirect(new URL("/login", request.url)) : response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && protectedPage) return NextResponse.redirect(new URL("/login", request.url));
  if (user && protectedPage) {
    const reason = sessionExpiryReason(request.cookies.get(SESSION_STARTED_COOKIE)?.value, request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value, Date.now());
    const cookieOptions = sessionCookieOptions(request.nextUrl.protocol === "https:");
    if (reason) {
      await supabase.auth.signOut({ scope: "local" });
      const redirect = NextResponse.redirect(new URL("/login?expired=1", request.url));
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      redirect.cookies.set(SESSION_ACTIVITY_COOKIE, "", { ...cookieOptions, maxAge: 0 });
      redirect.cookies.set(SESSION_STARTED_COOKIE, "", { ...sessionStartedCookieOptions(request.nextUrl.protocol === "https:"), maxAge: 0 });
      return redirect;
    }
    if (request.method === "POST") {
      response.cookies.set(SESSION_ACTIVITY_COOKIE, String(Date.now()), cookieOptions);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
