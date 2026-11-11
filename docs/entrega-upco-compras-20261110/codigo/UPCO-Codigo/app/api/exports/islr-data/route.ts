import { apiError, apiUser, readSettings } from "@/lib/tax/server";
import { islrXml, parsePeriod, retentionRows } from "@/lib/tax/exports";
import { allJoined } from "@/lib/tax/exportData";
import { makeIslrDataXlsx } from "@/lib/tax/islrXlsx";

export async function GET(request: Request) {
  const denied = await apiUser("exports.run"); if (denied) return denied;
  try {
    const { period } = parsePeriod(request);
    const all = await allJoined();
    const settings = await readSettings();
    const selected = retentionRows(all, period);
    islrXml(selected, all, settings, period);
    const bytes = makeIslrDataXlsx(selected.filter(x => x.document.islrApplies), period, settings.companyRif);
    return new Response(bytes as unknown as BodyInit, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="UPCO_ISLR_para_macro_${period}.xlsx"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) { return apiError(error); }
}
