import { getAccessContext } from "@/features/auth/access";
import { buildCloseXlsx } from "@/features/administration/reports/exports";
import { hasAdministrationPermission } from "@/features/administration/permissions/access-control";

export async function GET(request: Request) {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || !hasAdministrationPermission(access, "reports.export")) return Response.json({ error: "Acceso denegado." }, { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    const from = params.get("from");
    const to = params.get("to");
    const file = await buildCloseXlsx(access, from, to);
    return new Response(new Uint8Array(file).buffer as ArrayBuffer, { headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="cierre-contable-${from}-a-${to}.xlsx"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo generar el cierre XLSX." }, { status: 400 });
  }
}
