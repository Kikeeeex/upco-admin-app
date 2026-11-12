import { getAccessContext } from "@/features/auth/access";
import { buildBookXlsx } from "@/features/administration/reports/exports";
import { hasAdministrationPermission } from "@/features/administration/permissions/access-control";

export async function GET(request: Request) {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || !hasAdministrationPermission(access, "reports.export")) return Response.json({ error: "Acceso denegado." }, { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    const period = params.get("period");
    const half = params.get("half");
    const file = await buildBookXlsx(access, period, half);
    const body = new Uint8Array(file).buffer as ArrayBuffer;
    return new Response(body, { headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="libro-compras-${period}${half ? `-Q${half}` : ""}.xlsx"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo generar el libro XLSX." }, { status: 400 });
  }
}
