import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { CreateFiscalVendorForm } from "@/components/administration/fiscal-vendor-forms";
import { hasAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";
import { auditFiscalVendors, type FiscalVendorAuditRow } from "@/features/administration/vendors/audit";

type SearchParams = { buscar?: string | string[]; auditoria?: string | string[] };
type FiscalVendorRow = {
  id: string; legal_name: string; tax_identifier: string; tax_address: string; taxpayer_type: string | null; person_type: string;
  residency: string | null; iva_retention_rate: number; active: boolean; review_state: string;
  source_file: string | null; fiscal_machine_numbers: string | null;
};

export default async function ProveedoresFiscalesPage({ searchParams }: { searchParams?: Promise<SearchParams> } = {}) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["vendors.read", "vendors.manage"]);
  const canManage = hasAdministrationPermission(access, "vendors.manage");
  const rawQuery = (await searchParams)?.buscar;
  const query = (typeof rawQuery === "string" ? rawQuery : "").trim().slice(0, 100);
  const rawAudit = (await searchParams)?.auditoria;
  const auditMode = rawAudit === "1";
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const selectVendors = () => access.supabase.from("fiscal_vendors")
    .select("id, legal_name, tax_identifier, tax_address, taxpayer_type, person_type, residency, iva_retention_rate, active, review_state, source_file, fiscal_machine_numbers")
    .eq("organization_id", access.organizationId).order("legal_name").limit(500);
  const [nameResult, rifResult, auditResult] = await Promise.all([
    query ? selectVendors().ilike("legal_name", pattern) : selectVendors(),
    query ? selectVendors().ilike("tax_identifier", pattern) : Promise.resolve(null),
    auditMode ? selectVendors() : Promise.resolve(null),
  ]);
  const error = nameResult.error ?? rifResult?.error ?? null;
  const vendors = [...new Map([...(nameResult.data ?? []), ...(rifResult?.data ?? [])].map((vendor) => [vendor.id, vendor])).values()] as FiscalVendorRow[];
  vendors.sort((left, right) => left.legal_name.localeCompare(right.legal_name, "es"));
  const auditReport = auditResult?.data ? auditFiscalVendors(auditResult.data as FiscalVendorAuditRow[]) : null;
  const auditHref = auditMode ? `/administracion/proveedores${query ? `?buscar=${encodeURIComponent(query)}` : ""}` : `/administracion/proveedores?${new URLSearchParams({ ...(query ? { buscar: query } : {}), auditoria: "1" }).toString()}`;
  return <div className="page-content">
    <div className="page-heading administration-vendor-heading"><div><span className="eyebrow">DIRECTORIO FISCAL</span><h1>Proveedores</h1><p>Datos tributarios que alimentan facturas y comprobantes.</p></div>
      <div className="administration-vendor-actions"><Link className="quiet-button" href={auditHref}>{auditMode ? "Ocultar revisión" : "Revisar todos"}</Link></div>
    </div>
    {canManage && <details className="administration-create-panel">
      <summary>Nuevo proveedor</summary>
      <CreateFiscalVendorForm />
    </details>}
    {auditMode && auditResult?.error && <p className="error-message" role="alert">No se pudo cargar el padrón para la revisión.</p>}
    {auditMode && auditReport && <section className="work-card administration-vendor-audit">
      <div className="administration-panel-heading"><div><h2>Auditoría de proveedores</h2><p>{auditReport.summary.total} fichas · {auditReport.summary.importedTotal} con archivo fuente</p></div><Link className="quiet-button" href="/api/administracion/proveedores/auditoria"><span aria-hidden="true">↓</span> Descargar informe CSV</Link></div>
      <div className="administration-vendor-audit-summary"><strong>{auditReport.summary.highPriority}</strong><span>fichas con observaciones prioritarias</span><strong>{auditReport.summary.withIssues}</strong><span>con alguna observación · {auditReport.summary.pendingReview} pendientes de revisión fiscal</span></div>
      <p className="muted-note">Esta revisión detecta inconsistencias en los datos guardados. No consulta al SENIAT ni comprueba la vigencia de un RIF.</p>
      {auditReport.items.some((item) => item.issues.length > 0) ? <div className="table-scroll administration-vendor-audit-table"><table><thead><tr><th>Proveedor</th><th>RIF</th><th>Observaciones</th><th>Acción</th></tr></thead><tbody>
        {auditReport.items.filter((item) => item.issues.length > 0).slice(0, 20).map((item) => <tr key={item.id}><td>{item.name}</td><td className="administration-mono">{item.rif}</td><td>{item.issues.map((issue) => issue.label).join(" · ")}</td><td>{canManage && <Link className="text-link" href={`/administracion/proveedores/${item.id}`}>Editar</Link>}</td></tr>)}
      </tbody></table></div> : <p className="work-empty">No se encontraron observaciones en las fichas revisadas.</p>}
      {auditReport.summary.withIssues > 20 && <p className="muted-note">Se muestran 20 fichas; descarga el CSV para ver el informe completo.</p>}
    </section>}
    <section className="work-card work-list">
      <div className="administration-panel-heading"><div><h2>Directorio fiscal</h2><p>{vendors.length} proveedores {query ? "encontrados" : "registrados"}</p></div></div>
      <form method="get" action="/administracion/proveedores" className="filter-form" role="search" aria-label="Buscar proveedores fiscales">
        <div className="field"><label htmlFor="fiscal-vendor-search">Razón social o RIF</label><input id="fiscal-vendor-search" name="buscar" maxLength={100} defaultValue={query} /></div>
        <button className="quiet-button" type="submit">Buscar</button>
      </form>
      {error ? <p className="error-message" role="alert">No se pudo cargar el directorio fiscal. Aplica su migración y vuelve a intentarlo.</p> : vendors.length === 0 ?
        <p className="work-empty">{query ? "No se encontraron proveedores con esa razón social o RIF." : "Aún no hay proveedores fiscales registrados."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>RIF</th><th>Tipo</th><th>Persona</th><th>Ret. IVA</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          {vendors.map((vendor) => <tr key={vendor.id}>
            <td><div className="administration-vendor-cell"><span aria-hidden="true">{vendor.legal_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase()}</span><strong>{vendor.legal_name}</strong></div></td>
            <td className="administration-mono">{vendor.tax_identifier}</td>
            <td>{vendor.taxpayer_type || "Sin clasificar"}</td><td>{vendor.person_type === "natural" ? "Natural" : "Jurídica"}</td>
            <td className="administration-mono">{vendor.iva_retention_rate}%</td><td><span className={`administration-status ${vendor.active ? "administration-status-issued" : "administration-status-voided"}`}>{vendor.active ? "Activo" : "Inactivo"}</span></td>
            <td><Link className="text-link" href={`/administracion/proveedores/${vendor.id}`}>Ver ficha</Link></td>
          </tr>)}
        </tbody></table></div>}
    </section>
  </div>;
}
