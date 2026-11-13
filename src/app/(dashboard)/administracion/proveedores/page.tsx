import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { CreateFiscalVendorForm } from "@/components/administration/fiscal-vendor-forms";
import { hasAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

type SearchParams = { buscar?: string | string[] };
type FiscalVendorRow = {
  id: string; legal_name: string; tax_identifier: string; taxpayer_type: string | null; person_type: string;
  iva_retention_rate: number; active: boolean; review_state: string;
};

export default async function ProveedoresFiscalesPage({ searchParams }: { searchParams?: Promise<SearchParams> } = {}) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["vendors.read", "vendors.manage"]);
  const canManage = hasAdministrationPermission(access, "vendors.manage");
  const rawQuery = (await searchParams)?.buscar;
  const query = (typeof rawQuery === "string" ? rawQuery : "").trim().slice(0, 100);
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const selectVendors = () => access.supabase.from("fiscal_vendors")
    .select("id, legal_name, tax_identifier, taxpayer_type, person_type, iva_retention_rate, active, review_state")
    .eq("organization_id", access.organizationId).order("legal_name").limit(500);
  const nameResult = await (query ? selectVendors().ilike("legal_name", pattern) : selectVendors());
  const rifResult = query ? await selectVendors().ilike("tax_identifier", pattern) : null;
  const error = nameResult.error ?? rifResult?.error ?? null;
  const vendors = [...new Map([...(nameResult.data ?? []), ...(rifResult?.data ?? [])].map((vendor) => [vendor.id, vendor])).values()] as FiscalVendorRow[];
  vendors.sort((left, right) => left.legal_name.localeCompare(right.legal_name, "es"));
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">DIRECTORIO FISCAL</span><h1>Proveedores</h1><p>Datos tributarios que alimentan facturas y comprobantes.</p></div>
    {canManage && <details className="administration-create-panel">
      <summary>Nuevo proveedor</summary>
      <CreateFiscalVendorForm />
    </details>}
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
