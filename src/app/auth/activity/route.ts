import { getAccessContext } from "@/features/auth/access";

export async function POST() {
  const access = await getAccessContext();
  return new Response(null, { status: access.kind === "allowed" ? 204 : 401, headers: { "Cache-Control": "no-store" } });
}
