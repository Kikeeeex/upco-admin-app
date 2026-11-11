import { apiError, apiUser, readSettings } from "@/lib/tax/server";
import { islrXml, parsePeriod, retentionRows } from "@/lib/tax/exports";
import { allJoined } from "@/lib/tax/exportData";

export async function GET(request: Request) {
  const denied = await apiUser("exports.run"); if (denied) return denied;
  try {
    const { period } = parsePeriod(request);
    const all = await allJoined();
    const content = islrXml(retentionRows(all, period), all, await readSettings(), period);
    return new Response(content, { headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="UPCO_Retenciones_ISLR_${period}.xml"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) { return apiError(error); }
}
