import Link from "next/link";
import { AdministrationDraftForm } from "@/components/administration/document-draft-form";
import { getAccessContext } from "@/features/auth/access";
import { loadAdministrationPeriodStatus } from "@/features/administration/reports/status";
import { hasAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

type ComprasSearchParams = { emision?: string; estado?: string; periodo?: string; quincena?: string; period?: string; half?: string; buscar?: string };
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
  const requestedPeriod = params.period ?? params.periodo;
  const requestedHalf = params.half ?? params.quincena;
  const period = typeof requestedPeriod === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedPeriod) ? requestedPeriod : caracasPeriod;
  const half = requestedHalf === "1" || requestedHalf === "2" ? requestedHalf : caracasDay <= 15 ? "1" : "2";
  const state = documentStates.some((option) => option.value === params.estado) ? params.estado as typeof documentStates[number]["value"] : "activos";
  const search = typeof params.buscar === "string" ? params.buscar.trim().slice(0, 100) : "";
  return <ComprasContent issued={params.emision === "ok"} period={period} half={half} state={state} search={search} />;
}

async function ComprasContent({ issued, period, half, state, search }: { issued: boolean; period: string; half: "1" | "2"; state: typeof documentStates[number]["value"]; search: string }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["purchases.read", "purchases.manage", "retentions.read"]);
  const canManage = hasAdministrationPermission(access, "purchases.manage");
  const canReadPurchases = hasAdministrationPermission(access, "purchases.read") || canManage;
  const canReadRetentions = hasAdministrationPermission(access, "retentions.read");
  const canReadFiscalVendors = canReadPurchases;
  let documentQuery = access.supabase.from("administration_documents")
    .select("id, fiscal_vendor_id, document_type, invoice_number, issued_at, event_at, tax_period, tax_half, base16_cents, base8_cents, calculation_snapshot, status, created_at", { count: "exact" })
    .eq("organization_id", access.organizationId);
  if (state === "activos" || state === "draft") {
    documentQuery = documentQuery.or(`tax_period.eq.${period},and(status.eq.draft,tax_period.is.null)`);
    documentQuery = documentQuery.or(`tax_half.eq.${Number(half)},and(status.eq.draft,tax_half.is.null),and(status.eq.draft,tax_period.is.null)`);
  } else {
    documentQuery = documentQuery.eq("tax_period", period);
    documentQuery = documentQuery.eq("tax_half", Number(half));
  }
  if (state === "activos") documentQuery = documentQuery.in("status", ["draft", "issued"]);
  else documentQuery = documentQuery.eq("status", state);
  const [documentsResult, vendorsResult, invoicesResult, retentionStatus] = await Promise.all([
    canReadPurchases ? documentQuery.order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], count: 0, error: null }),
    canReadFiscalVendors ? access.supabase.from("fiscal_vendors").select("id, legal_name, active, review_state, iva_retention_rate")
      .eq("organization_id", access.organizationId).order("legal_name").limit(200) : Promise.resolve({ data: [], error: null }),
    canManage ? access.supabase.from("administration_documents").select("id, invoice_number, issued_at, fiscal_vendor_id")
      .eq("organization_id", access.organizationId).eq("document_type", "invoice").eq("status", "issued").order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
    canReadRetentions ? loadAdministrationPeriodStatus(access, period, Number(half) as 1 | 2) : Promise.resolve(null),
  ]);
  const allRows = documentsResult.data ?? [];
  const vendorRows = vendorsResult.data ?? [];
  const vendorLabels = new Map(vendorRows.map((vendor) => [vendor.id, vendor.legal_name]));
  const searchTerm = search.toLocaleLowerCase("es");
  const rows = search ? allRows.filter((row) => `${row.invoice_number ?? ""} ${row.fiscal_vendor_id ? vendorLabels.get(row.fiscal_vendor_id) ?? "" : ""}`.toLocaleLowerCase("es").includes(searchTerm)) : allRows;
  const invoices = invoicesResult.data ?? [];
  const typeLabels: Record<string, string> = { invoice: "Factura", credit_note: "Nota de crédito", debit_note: "Nota de débito" };
  const periodLabel = new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", month: "long", year: "numeric" }).format(new Date(`${period}-01T12:00:00-04:00`));
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const periodStart = half === "1" ? `1 al 15 de ${periodLabel}` : `16 al ${lastDay} de ${periodLabel}`;
  const filterHref = (nextState: string, nextHalf: "1" | "2") => `/administracion/compras?${new URLSearchParams({ period, half: nextHalf, estado: nextState }).toString()}`;

  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">REGISTRO DOCUMENTAL</span><h1>Compras y notas</h1><p>Facturas, notas de crédito y débito con sus retenciones.</p></div>
    {issued && <p className="success-message" role="status">Documento emitido con cálculo, configuración y distribución contable inmutables.</p>}
    {canManage && !vendorsResult.error && <details className="administration-create-panel">
      <summary>Nuevo documento</summary>
      <AdministrationDraftForm vendors={vendorRows} invoices={invoices} canIssue={access.role === "admin"} />
    </details>}
    {canReadPurchases && <section className="work-card work-list">
      <div className="administration-purchase-filters">
        {canReadPurchases && <form action="/administracion/compras" method="get" className="administration-purchase-search" role="search" aria-label="Buscar documentos de compra">
          <input type="hidden" name="period" value={period} /><input type="hidden" name="half" value={half} /><input type="hidden" name="estado" value={state} />
          <label className="sr-only" htmlFor="administration-document-search">Buscar factura o proveedor</label><input id="administration-document-search" name="buscar" placeholder="Buscar factura o proveedor" maxLength={100} defaultValue={search} />
          <button className="quiet-button" type="submit">Buscar</button>
        </form>}
        <nav className="administration-filter-pills" aria-label="Filtrar documentos por estado">
          {documentStates.map((option) => <Link key={option.value} href={filterHref(option.value, half)} aria-current={state === option.value ? "page" : undefined} className={state === option.value ? "is-active" : undefined}>{option.label}</Link>)}
        </nav>
        <nav className="administration-filter-pills administration-half-filters" aria-label="Filtrar documentos por quincena">
          {[{ value: "1" as const, label: "1.ª quincena" }, { value: "2" as const, label: "2.ª quincena" }].map((option) => <Link key={option.value} href={filterHref(state, option.value)} aria-current={half === option.value ? "page" : undefined} className={half === option.value ? "is-active" : undefined}>{option.label}</Link>)}
        </nav>
        <form action="/administracion/compras" method="get" className="administration-period-filter">
          <input type="hidden" name="estado" value={state} /><input type="hidden" name="half" value={half} />
          <label htmlFor="administration-period">Período</label><input id="administration-period" name="period" type="month" defaultValue={period} />
          <button className="quiet-button" type="submit">Actualizar</button>
        </form>
      </div>
      <div className="administration-panel-heading"><div><h2>Compras y documentos</h2><p>{periodStart} · {search ? `${rows.length} resultados para “${search}”` : `${documentsResult.count ?? rows.length} documentos encontrados`}{(state === "activos" || state === "draft") ? " · incluye borradores sin período asignado" : ""}</p></div></div>
      {documentsResult.error ? <p className="error-message" role="alert">No se pudo cargar la lista. Aplica las migraciones de Administración V2.</p> : rows.length === 0 ?
        <p className="work-empty">Aún no hay documentos para este período.</p> :
        <div className="table-scroll"><table><thead><tr><th>Tipo y número</th><th>Proveedor</th><th>Emisión</th><th>Base 16 %</th><th>Base 8 %</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}><td><strong>{typeLabels[row.document_type] ?? row.document_type}</strong><br />{row.invoice_number ?? "Sin número"}</td><td>{row.fiscal_vendor_id ? vendorLabels.get(row.fiscal_vendor_id) ?? "Proveedor fiscal" : "Sin seleccionar"}</td><td>{row.event_at ?? row.issued_at ?? "—"}</td><td>{row.base16_cents == null ? "—" : `Bs. ${(Number(row.base16_cents) / 100).toFixed(2)}`}</td><td>{row.base8_cents == null ? "—" : `Bs. ${(Number(row.base8_cents) / 100).toFixed(2)}`}</td><td>{row.status === "issued" ? `Bs. ${(Number((row.calculation_snapshot as Record<string, unknown> | null)?.totalCents ?? 0) / 100).toFixed(2)}` : "—"}</td><td><span className={`administration-status administration-status-${row.status}`}>{row.status === "issued" ? "Emitido" : row.status === "voided" ? "Anulado" : "Borrador"}</span></td><td><Link className="text-link" href={`/administracion/compras/${row.id}`}>{row.status === "draft" ? "Abrir" : "Ver"}</Link></td></tr>)}
        </tbody></table></div>}
      {canManage && vendorsResult.error && <p className="error-message">No se pudo cargar el directorio fiscal para crear borradores.</p>}
      {!documentsResult.error && rows.length === 50 && <p className="muted-note">Se muestran 50 resultados de {documentsResult.count ?? rows.length} documentos.</p>}
    </section>}
    {canReadRetentions && <section id="retenciones" className="work-card administration-retentions-summary">
      <div className="administration-panel-heading"><div><h2>Retenciones de la quincena</h2><p>IVA, ISLR e IGTF de los documentos emitidos en {periodStart.toLowerCase()}.</p></div><Link className="text-link" href={`/administracion/reportes?period=${period}&half=${half}#declaraciones`}>Ver salidas →</Link></div>
      {retentionStatus?.error ? <p className="error-message">No se pudo cargar el resumen de retenciones del período.</p> : <dl className="detail-grid"><div><dt>Documentos emitidos</dt><dd>{retentionStatus?.issued ?? 0}</dd></div><div><dt>IVA retenido</dt><dd>Bs. {((retentionStatus?.ivaRetainedCents ?? 0) / 100).toFixed(2)}</dd></div><div><dt>ISLR retenido</dt><dd>Bs. {((retentionStatus?.islrRetainedCents ?? 0) / 100).toFixed(2)}</dd></div><div><dt>IVA mixto · requiere revisión</dt><dd>{retentionStatus?.mixedRateDocuments ?? 0}</dd></div></dl>}
      <dl className="detail-grid administration-retention-rules"><div><dt>IVA</dt><dd>Alícuotas 16 % y 8 %; retención de 0 %, 75 % o 100 % sobre el IVA, según proveedor y documento.</dd></div><div><dt>ISLR</dt><dd>Catálogo de 86 conceptos; los cálculos manuales guardan tasa, sustraendo y motivo.</dd></div><div><dt>IGTF</dt><dd>3 % sobre la base indicada, sumado al neto a pagar.</dd></div></dl>
    </section>}
  </div>;
}
