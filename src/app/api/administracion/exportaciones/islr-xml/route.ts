import { getAccessContext } from "@/features/auth/access";
import { buildIslrXml } from "@/features/administration/reports/exports";
import { hasAdministrationPermission } from "@/features/administration/permissions/access-control";

export async function GET(request: Request) {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || !hasAdministrationPermission(access, "reports.export")) return Response.json({ error: "Acceso denegado." }, { status: 403 });
  try {
    const period = new URL(request.url).searchParams.get("period");
    const body = await buildIslrXml(access, period);
    return new Response(body, { headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="islr-${period}.xml"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo generar XML ISLR." }, { status: 400 });
  }
}
