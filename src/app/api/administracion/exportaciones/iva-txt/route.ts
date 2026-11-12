import { getAccessContext } from "@/features/auth/access";
import { buildIvaTxt } from "@/features/administration/reports/exports";
import { hasAdministrationPermission } from "@/features/administration/permissions/access-control";

export async function GET(request: Request) {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || !hasAdministrationPermission(access, "reports.export")) return Response.json({ error: "Acceso denegado." }, { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    const period = params.get("period");
    const half = params.get("half");
    const body = await buildIvaTxt(access, period, half);
    return new Response(body, { headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="iva-${period}-Q${half}.txt"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo generar TXT IVA." }, { status: 400 });
  }
}
