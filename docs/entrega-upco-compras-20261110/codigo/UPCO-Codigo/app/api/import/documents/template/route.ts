import { apiUser } from "@/lib/tax/server";
import { makeImportTemplateXlsx } from "@/lib/tax/importSpreadsheet";

export async function GET() {
  const denied = await apiUser("imports.run"); if (denied) return denied;
  return new Response(makeImportTemplateXlsx() as unknown as BodyInit, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": 'attachment; filename="UPCO_Plantilla_Importar_Documentos.xlsx"',
    "Cache-Control": "no-store",
  } });
}
