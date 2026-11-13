import { getAccessContext } from "@/features/auth/access";
import { buildIslrMacroXlsx } from "@/features/administration/reports/exports";
import { hasAdministrationPermission } from "@/features/administration/permissions/access-control";

export async function GET(request: Request) {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || !hasAdministrationPermission(access, "reports.export")) return Response.json({ error: "Acceso denegado." }, { status: 403 });
  try {
    const period = new URL(request.url).searchParams.get("period");
    const bytes = await buildIslrMacroXlsx(access, period);
    return new Response(bytes.buffer as ArrayBuffer, { headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="UPCO_ISLR_para_macro_${period}.xlsx"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo generar el XLSX auxiliar ISLR." }, { status: 400 });
  }
}
