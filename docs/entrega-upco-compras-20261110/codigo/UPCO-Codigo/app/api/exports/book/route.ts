import { apiError, apiUser, readSettings } from "@/lib/tax/server";
import { bookRows, parsePeriod } from "@/lib/tax/exports";
import { allJoined } from "@/lib/tax/exportData";
import { makeBookXlsx } from "@/lib/tax/xlsx";
import { fail } from "@/lib/tax/core";

export async function GET(request: Request) {
  const denied = await apiUser("exports.run"); if (denied) return denied;
  try {
    const { period, half } = parsePeriod(request);
    const all = await allJoined();
    const drafts = all.filter(x => x.document.status === "draft" && x.document.period === period && (!half || x.document.half === half));
    if (drafts.length) fail(`Libro de compras pendiente: hay ${drafts.length} documento(s) en borrador del período. Emítalos o elimínelos antes de exportar el libro final.`);
    const rows = bookRows(all, period, half);
    const bytes = makeBookXlsx(rows, period, half, await readSettings(), all);
    const name = `UPCO_Libro_Compras_${period}${half ? `_Q${half}` : "_Mensual"}.xlsx`;
    return new Response(bytes as unknown as BodyInit, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) { return apiError(error); }
}
