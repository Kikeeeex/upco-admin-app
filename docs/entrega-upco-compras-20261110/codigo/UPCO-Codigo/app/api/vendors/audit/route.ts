import { getDb, getSqlite } from "@/db";
import { vendors } from "@/db/schema";
import { fail, InputError } from "@/lib/tax/core";
import { apiError, apiUser } from "@/lib/tax/server";
import { confirmImportedVendors, ImportConfirmationError } from "@/lib/tax/confirmImportedVendors";
import { auditVendors, vendorAuditCsv } from "@/lib/tax/vendorAudit";

export async function GET(request: Request) {
  const denied = await apiUser(); if (denied) return denied;
  try {
    const rows = await getDb().select().from(vendors);
    const report = auditVendors(rows);
    if (new URL(request.url).searchParams.get("format") === "csv") {
      return new Response(vendorAuditCsv(report), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="UPCO_revision_proveedores.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  const denied = await apiUser("vendors.manage"); if (denied) return denied;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.confirm !== "CONFIRMAR_DATOS_IMPORTADOS") fail("Confirma la revisión masiva de proveedores importados");
    return Response.json(confirmImportedVendors(getSqlite(), Number(body.expectedPending)));
  } catch (error) { return apiError(error instanceof ImportConfirmationError ? new InputError(error.message) : error); }
}
