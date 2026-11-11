import { apiError, apiUser, readSettings } from "@/lib/tax/server";
import { ivaRows, ivaTxt, parsePeriod } from "@/lib/tax/exports";
import { allJoined } from "@/lib/tax/exportData";

export async function GET(request: Request) {
  const denied = await apiUser("exports.run"); if (denied) return denied;
  try {
    const { period, half } = parsePeriod(request, true);
    const all = await allJoined();
    const rows = ivaRows(all, period, half!);
    const content = ivaTxt(rows, all, await readSettings(), period, half!);
    return new Response(content, { headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="UPCO_Retenciones_IVA_${period}_Q${half}.txt"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) { return apiError(error); }
}
