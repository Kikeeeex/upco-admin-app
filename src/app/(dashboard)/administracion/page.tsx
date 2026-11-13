import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { loadAdministrationPeriodStatus } from "@/features/administration/reports/status";
import { hasAdministrationPermission, hasAnyAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

type Search = { period?: string; half?: string };
function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit" }).format(new Date());
}
function cents(snapshot: unknown, key: string) {
  const values = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : {};
  const value = Number(values[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}
function money(value: number) {
  return `Bs. ${new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100)}`;
}
function periodLabel(period: string, half: 1 | 2) {
  const month = new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", month: "long", year: "numeric" })
    .format(new Date(`${period}-01T12:00:00-04:00`));
  const [year, monthNumber] = period.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return half === 1 ? `1 al 15 de ${month}` : `16 al ${lastDay} de ${month}`;
}

export default async function AdministrationPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["purchases.read", "purchases.manage", "vendors.read", "vendors.manage", "retentions.read", "books.read", "imports.validate", "reports.export", "fiscal_settings.read", "fiscal_settings.manage"]);
  const canSeeDocuments = hasAnyAdministrationPermission(access, ["purchases.read", "purchases.manage", "retentions.read", "books.read", "imports.validate", "reports.export"]);
  const canSeePurchaseDetails = hasAnyAdministrationPermission(access, ["purchases.read", "purchases.manage", "books.read", "reports.export"]);
  const canSeeVendors = hasAnyAdministrationPermission(access, ["vendors.read", "vendors.manage", "purchases.read", "purchases.manage", "imports.validate", "reports.export"]);
  const canCreatePurchases = hasAdministrationPermission(access, "purchases.manage");
  const canSeeReports = hasAnyAdministrationPermission(access, ["reports.export", "books.read", "imports.validate"]);
  const params = await searchParams;
  const period = params.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period) ? params.period : currentPeriod();
  const localDay = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Caracas", day: "2-digit" }).format(new Date()));
  const half: 1 | 2 = params.half === "1" || params.half === "2" ? Number(params.half) as 1 | 2 : localDay <= 15 ? 1 : 2;
  const [status, recentResult, vendorResult] = await Promise.all([
    canSeeDocuments ? loadAdministrationPeriodStatus(access, period, half) : Promise.resolve(null),
    canSeePurchaseDetails ? access.supabase.from("administration_documents")
      .select("id, invoice_number, document_type, fiscal_vendor_id, event_at, issued_at, tax_period, tax_half, status, calculation_snapshot")
      .eq("organization_id", access.organizationId).neq("status", "voided").order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [], error: null }),
    canSeeVendors ? access.supabase.from("fiscal_vendors").select("id, legal_name").eq("organization_id", access.organizationId).limit(200) : Promise.resolve({ data: [], error: null }),
  ]);
  const vendorLabels = new Map((vendorResult.data ?? []).map((vendor) => [vendor.id, vendor.legal_name]));
  const documentTypes: Record<string, string> = { invoice: "Factura", credit_note: "Nota de crédito", debit_note: "Nota de débito" };
  const range = periodLabel(period, half);

  return <div className="page-content administration-dashboard">
    <div className="page-heading administration-dashboard-heading">
      <div><span className="eyebrow">Panel de control</span><h1>Tu operación, al día.</h1><p>Control de compras y retenciones de {range}.</p></div>
      <div className="administration-dashboard-actions">
        {canSeeReports && <Link className="quiet-button" href={`/administracion/reportes?period=${period}&half=${half}`}>Ver reportes</Link>}
        {canCreatePurchases && <Link className="primary-button" href={`/administracion/compras?period=${period}&half=${half}`}>Nueva compra</Link>}
      </div>
    </div>

    <section className="administration-hero" aria-label="Período activo">
      <div><span>PERÍODO ACTIVO · {half === 1 ? "PRIMERA" : "SEGUNDA"} QUINCENA</span><h2>{range}</h2>
        <p>Registra las compras, revisa las retenciones y prepara las salidas del período.</p></div>
      {canSeePurchaseDetails && <Link href={`/administracion/compras?period=${period}&half=${half}`} className="administration-hero-link">Abrir compras <span aria-hidden="true">→</span></Link>}
    </section>
    <nav className="administration-period-chips" aria-label="Quincena del resumen">
      {[{ value: 1, label: "1.ª quincena" }, { value: 2, label: "2.ª quincena" }].map((option) => <Link key={option.value} href={`/administracion?period=${period}&half=${option.value}`} aria-current={half === option.value ? "page" : undefined} className={half === option.value ? "is-active" : undefined}>{option.label}</Link>)}
    </nav>

    {!canSeeDocuments ? <p className="administration-lock-note">Tus permisos no incluyen consulta de documentos administrativos; puedes usar las secciones asignadas desde el sidebar.</p> : status?.error ? <p className="error-message">No se pudo cargar el resumen del período.</p> : status && <>
      <section className="administration-kpi-grid" aria-label="Indicadores del período">
        {canSeePurchaseDetails && <><article className="administration-kpi"><div><span>Documentos</span><span aria-hidden="true">▤</span></div><strong>{status.total}</strong><small>En la quincena</small></article>
        <article className="administration-kpi"><div><span>Total de compras</span><span aria-hidden="true">◉</span></div><strong>{money(status.invoiceTotalCents)}</strong><small>Documentos emitidos</small></article></>}
        <article className="administration-kpi"><div><span>IVA retenido</span><span aria-hidden="true">✓</span></div><strong>{money(status.ivaRetainedCents)}</strong><small>Por enterar</small></article>
        <article className="administration-kpi"><div><span>ISLR retenido</span><span aria-hidden="true">%</span></div><strong>{money(status.islrRetainedCents)}</strong><small>Del período</small></article>
      </section>

      {canSeePurchaseDetails && <div className="administration-reference-overview">
        <section className="work-card work-list administration-recent-documents">
          <div className="administration-panel-heading"><div><h2>Documentos recientes</h2><p>Últimas facturas y notas registradas</p></div>
            <Link className="text-link" href={`/administracion/compras?period=${period}&half=${half}`}>Ver todos →</Link>
          </div>
          {recentResult.error ? <p className="muted-note">No se pudo cargar la lista reciente.</p> : !recentResult.data?.length ? <p className="work-empty">Aún no hay compras. Registra la primera factura para comenzar.</p> :
            <div className="table-scroll administration-table-scroll"><table><thead><tr><th>Documento</th><th>Proveedor</th><th>Fecha</th><th className="number-cell">Total</th><th>Estado</th></tr></thead><tbody>
              {recentResult.data.map((document) => <tr key={document.id}>
                <td><Link href={`/administracion/compras/${document.id}`}>{documentTypes[document.document_type] ?? document.document_type} Nº {document.invoice_number ?? "sin número"}</Link></td>
                <td>{document.fiscal_vendor_id ? vendorLabels.get(document.fiscal_vendor_id) ?? "Proveedor" : "Proveedor"}</td>
                <td>{document.issued_at ?? document.event_at ?? "—"}</td>
                <td className="number-cell">{document.status === "issued" ? money(cents(document.calculation_snapshot, "totalCents")) : "—"}</td>
                <td><span className={`administration-status administration-status-${document.status}`}>{document.status === "issued" ? "Emitido" : "Borrador"}</span></td>
              </tr>)}
            </tbody></table></div>}
        </section>
        <aside className="work-card administration-period-panel">
          <div className="administration-panel-heading"><div><h2>En esta quincena</h2><p>Vista rápida del cierre</p></div><span aria-hidden="true">▦</span></div>
          <div className="administration-period-stat"><span>Compras registradas</span><strong>{status.total}</strong><div><span style={{ width: status.total ? "100%" : "0%" }} /></div></div>
          <div className="administration-period-stat"><span>Comprobantes emitidos</span><strong>{status.issued}</strong><div><span style={{ width: `${status.total ? Math.round((status.issued / status.total) * 100) : 0}%` }} /></div></div>
          {canSeeReports && <Link href={`/administracion/reportes?period=${period}&half=${half}`} className="administration-period-action">Preparar cierre</Link>}
        </aside>
      </div>}
    </>}
  </div>;
}
