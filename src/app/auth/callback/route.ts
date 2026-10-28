import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/features/auth/supabase-server";
import { getAccessContext } from "@/features/auth/access";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const supabase = await createSupabaseServerClient();
  if (!code || !supabase) return NextResponse.redirect(new URL("/login", request.url));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login", request.url));
  const access = await getAccessContext();
  return NextResponse.redirect(new URL(access.kind === "allowed" ? "/inicio" : "/acceso-denegado", request.url));
}
