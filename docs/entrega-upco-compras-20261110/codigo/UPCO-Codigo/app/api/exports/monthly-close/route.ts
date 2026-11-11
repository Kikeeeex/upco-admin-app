import { apiError, apiUser, readSettings } from "@/lib/tax/server";
import { allJoined } from "@/lib/tax/exportData";
import { makeMonthlyCloseXlsx, monthlyCloseRows, parseCloseRange } from "@/lib/tax/monthlyClose";

export async function GET(request: Request) {
  const denied = await apiUser("exports.run"); if (denied) return denied;
  try {
    const { from, to } = parseCloseRange(request);
    const rows = monthlyCloseRows(await allJoined(), from, to);
    const bytes = makeMonthlyCloseXlsx(rows, from, to, await readSettings());
    return new Response(bytes as unknown as BodyInit, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="UPCO_Cierre_Contable_${from}_a_${to}.xlsx"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) { return apiError(error); }
}
