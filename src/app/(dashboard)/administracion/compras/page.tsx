import Link from "next/link";
import { AdministrationDraftForm } from "@/components/administration/document-draft-form";
import { getAccessContext } from "@/features/auth/access";
import { hasAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

type ComprasSearchParams = { emision?: string; estado?: string; periodo?: string; quincena?: string };
const documentStates = [
  { value: "activos", label: "Todos los estados activos" },
  { value: "draft", label: "Borradores" },
  { value: "issued", label: "Emitidos" },
  { value: "voided", label: "Anulados" },
] as const;

export default async function ComprasPage({ searchParams }: { searchParams: Promise<ComprasSearchParams> }) {
  const params = await searchParams;
  const today = new Date();
  const caracasDay = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Caracas", day: "2-digit" }).format(today));
  const caracasPeriod = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit" }).format(today);
  const period = typeof params.periodo === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.periodo) ? params.periodo : caracasPeriod;
  const half = params.quincena === "1" || params.quincena === "2" || params.quincena === "all" ? params.quincena : caracasDay <= 15 ? "1" : "2";
  const state = documentStates.some((option) => option.value === params.estado) ? params.estado as typeof documentStates[number]["value"] : "activos";
  return <ComprasContent issued={params.emision === "ok"} period={period} half={half} state={state} />;
}

async function ComprasContent({ issued, period, half, state }: { issued: boolean; period: string; half: string; state: typeof documentStates[number]["value"] }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["purchases.read", "purchases.manage"]);
  const canManage = hasAdministrationPermission(access, "purchases.manage");
  const canReadFiscalVendors = hasAdministrationPermission(access, "purchases.read") || canManage;
  let documentQuery = access.supabase.from("administration_documents")
    .select("id, fiscal_vendor_id, document_type, invoice_number, issued_at, event_at, tax_period, tax_half, status, created_at", { count: "exact" })
    .eq("organization_id", access.organizationId).eq("tax_period", period);
  if (half !== "all") documentQuery = documentQuery.eq("tax_half", Number(half));
  if (state === "activos") documentQuery = documentQuery.in("status", ["draft", "issued"]);
  else documentQuery = documentQuery.eq("status", state);
  const [documentsResult, vendorsResult, invoicesResult] = await Promise.all([
    documentQuery.order("created_at", { ascending: false }).limit(50),
    canReadFiscalVendors ? access.supabase.from("fiscal_vendors").select("id, legal_name, active, review_state, iva_retention_rate")
      .eq("organization_id", access.organizationId).order("legal_name").limit(200) : Promise.resolve({ data: [], error: null }),
    canManage ? access.supabase.from("administration_documents").select("id, invoice_number, issued_at, fiscal_vendor_id")
      .eq("organization_id", access.organizationId).eq("document_type", "invoice").eq("status", "issued").order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
  ]);
  const rows = documentsResult.data ?? [];
  const vendorRows = vendorsResult.data ?? [];
  const vendorLabels = new Map(vendorRows.map((vendor) => [vendor.id, vendor.legal_name]));
  const invoices = invoicesResult.data ?? [];
  const typeLabels: Record<string, string> = { invoice: "Factura", credit_note: "Nota de crédito", debit_note: "Nota de débito" };
  const periodLabel = new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", month: "long", year: "numeric" }).format(new Date(`${period}-01T12:00:00-04:00`));
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const periodStart = half === "1" ? `1 al 15 de ${periodLabel}` : half === "2" ? `16 al ${lastDay} de ${periodLabel}` : `Mes completo · ${periodLabel}`;
  const filterHref = (nextState: string, nextHalf: string) => `/administracion/compras?${new URLSearchParams({ periodo: period, quincena: nextHalf, estado: nextState }).toString()}`;

  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">REGISTRO DOCUMENTAL</span><h1>Compras y documentos</h1><p>Facturas, notas de crédito y débito con sus retenciones.</p></div>
    {issued && <p className="success-message" role="status">Documento emitido con cálculo, configuración y distribución contable inmutables.</p>}
    {canManage && !vendorsResult.error && <details className="administration-create-panel">
      <summary>Nuevo documento</summary>
      <AdministrationDraftForm vendors={vendorRows} invoices={invoices} canIssue={access.role === "admin"} />
    </details>}
    <section className="work-card work-list">
      <div className="administration-purchase-filters">
        <nav className="administration-filter-pills" aria-label="Filtrar documentos por estado">
          {documentStates.map((option) => <Link key={option.value} href={filterHref(option.value, half)} aria-current={state === option.value ? "page" : undefined} className={state === option.value ? "is-active" : undefined}>{option.label}</Link>)}
        </nav>
        <nav className="administration-filter-pills administration-half-filters" aria-label="Filtrar documentos por quincena">
          {[{ value: "1", label: "1.ª quincena" }, { value: "2", label: "2.ª quincena" }, { value: "all", label: "Mes completo" }].map((option) => <Link key={option.value} href={filterHref(state, option.value)} aria-current={half === option.value ? "page" : undefined} className={half === option.value ? "is-active" : undefined}>{option.label}</Link>)}
        </nav>
        <form action="/administracion/compras" method="get" className="administration-period-filter">
          <input type="hidden" name="estado" value={state} /><input type="hidden" name="quincena" value={half} />
          <label htmlFor="administration-period">Período</label><input id="administration-period" name="periodo" type="month" value={period} />
          <button className="quiet-button" type="submit">Actualizar</button>
        </form>
      </div>
      <div className="administration-panel-heading"><div><h2>Compras y documentos</h2><p>{periodStart} · {documentsResult.count ?? rows.length} documentos encontrados</p></div></div>
      {documentsResult.error ? <p className="error-message" role="alert">No se pudo cargar la lista. Aplica las migraciones de Administración V2.</p> : rows.length === 0 ?
        <p className="work-empty">Aún no hay documentos para este período.</p> :
        <div className="table-scroll"><table><thead><tr><th>Tipo y número</th><th>Proveedor</th><th>Emisión</th><th>Período</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}><td><strong>{typeLabels[row.document_type] ?? row.document_type}</strong><br />{row.invoice_number ?? "Sin número"}</td><td>{row.fiscal_vendor_id ? vendorLabels.get(row.fiscal_vendor_id) ?? "Proveedor fiscal" : "Sin seleccionar"}</td><td>{row.event_at ?? row.issued_at ?? "—"}</td><td>{row.tax_period ? `${row.tax_period}${row.tax_half ? ` · Q${row.tax_half}` : ""}` : "Sin asignar"}</td><td><span className={`administration-status administration-status-${row.status}`}>{row.status === "issued" ? "Emitido" : row.status === "voided" ? "Anulado" : "Borrador"}</span></td><td><Link className="text-link" href={`/administracion/compras/${row.id}`}>{row.status === "draft" ? "Abrir" : "Ver"}</Link></td></tr>)}
        </tbody></table></div>}
      {canManage && vendorsResult.error && <p className="error-message">No se pudo cargar el directorio fiscal para crear borradores.</p>}
      {!documentsResult.error && rows.length === 50 && <p className="muted-note">Se muestran 50 resultados de {documentsResult.count ?? rows.length} documentos.</p>}
    </section>
  </div>;
}
