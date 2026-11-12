import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { CreateFiscalVendorForm } from "@/components/administration/fiscal-vendor-forms";
import { hasAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

type SearchParams = { buscar?: string | string[] };
type FiscalVendorRow = {
  id: string; legal_name: string; tax_identifier: string; person_type: string;
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
    .select("id, legal_name, tax_identifier, person_type, iva_retention_rate, active, review_state")
    .eq("organization_id", access.organizationId).order("legal_name").limit(100);
  const nameResult = await (query ? selectVendors().ilike("legal_name", pattern) : selectVendors());
  const rifResult = query ? await selectVendors().ilike("tax_identifier", pattern) : null;
  const error = nameResult.error ?? rifResult?.error ?? null;
  const vendors = [...new Map([...(nameResult.data ?? []), ...(rifResult?.data ?? [])].map((vendor) => [vendor.id, vendor])).values()] as FiscalVendorRow[];
  vendors.sort((left, right) => left.legal_name.localeCompare(right.legal_name, "es"));
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">DIRECTORIO FISCAL</span><h1>Proveedores</h1><p>Directorio fiscal separado del catálogo comercial de Procura.</p></div>
    <p className="administration-lock-note">La entrega más reciente reporta 347 proveedores. El registro está confirmado como vigente, pero esta versión aún no se ha conciliado con el snapshot previo ni con Procura; no se ha importado.</p>
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
        <div className="table-scroll"><table><thead><tr><th>Razón social</th><th>RIF</th><th>Persona</th><th>Retención IVA</th><th>Estado</th><th>Revisión</th><th>Ficha</th></tr></thead><tbody>
          {vendors.map((vendor) => <tr key={vendor.id}>
            <td>{vendor.legal_name}</td><td>{vendor.tax_identifier}</td><td>{vendor.person_type === "natural" ? "Natural" : "Jurídica"}</td>
            <td>{vendor.iva_retention_rate}%</td><td>{vendor.active ? "Activo" : "Inactivo"}</td>
            <td><span className="badge">{vendor.review_state === "confirmed" ? "Confirmado" : "Por revisar"}</span></td>
            <td><Link className="text-link" href={`/administracion/proveedores/${vendor.id}`}>Ver ficha</Link></td>
          </tr>)}
        </tbody></table></div>}
    </section>
  </div>;
}
