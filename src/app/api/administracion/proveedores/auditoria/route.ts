import { getAccessContext } from "@/features/auth/access";
import { hasAnyAdministrationPermission } from "@/features/administration/permissions/access-control";
import { auditFiscalVendors, fiscalVendorAuditCsv } from "@/features/administration/vendors/audit";

export async function GET() {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || !hasAnyAdministrationPermission(access, ["vendors.read", "vendors.manage"])) {
    return Response.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const { data, error } = await access.supabase.from("fiscal_vendors")
    .select("id, legal_name, tax_identifier, tax_address, taxpayer_type, person_type, residency, iva_retention_rate, active, review_state, source_file, fiscal_machine_numbers")
    .eq("organization_id", access.organizationId).order("legal_name").limit(500);
  if (error) return Response.json({ error: "No se pudo revisar el directorio fiscal." }, { status: 500 });
  const csv = fiscalVendorAuditCsv(auditFiscalVendors(data ?? []));
  return new Response(csv, { headers: {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": 'attachment; filename="UPCO_revision_proveedores.csv"',
    "cache-control": "no-store",
  } });
}
