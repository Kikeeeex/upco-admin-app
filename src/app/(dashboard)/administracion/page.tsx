import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { loadAdministrationDraftStatus } from "@/features/administration/reports/status";
import { hasAdministrationPermission, hasAnyAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

export default async function AdministrationPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["purchases.read", "purchases.manage", "vendors.read", "vendors.manage", "retentions.read", "books.read", "imports.validate", "reports.export", "fiscal_settings.read", "fiscal_settings.manage"]);
  const canSeeDocuments = hasAnyAdministrationPermission(access, ["purchases.read", "purchases.manage", "retentions.read", "books.read", "imports.validate", "reports.export"]);
  const canSeeVendors = hasAnyAdministrationPermission(access, ["vendors.read", "vendors.manage", "purchases.read", "purchases.manage", "imports.validate", "reports.export"]);
  const canCreatePurchases = hasAdministrationPermission(access, "purchases.manage");
  const canSeeReports = hasAdministrationPermission(access, "reports.export");
  const [status, recentResult, vendorResult] = await Promise.all([
    canSeeDocuments ? loadAdministrationDraftStatus(access) : Promise.resolve(null),
    canSeeDocuments ? access.supabase.from("administration_documents")
      .select("id, invoice_number, document_type, fiscal_vendor_id, event_at, issued_at, tax_period, tax_half, status")
      .eq("organization_id", access.organizationId).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [], error: null }),
    canSeeVendors ? access.supabase.from("fiscal_vendors").select("id, legal_name").eq("organization_id", access.organizationId).limit(200) : Promise.resolve({ data: [], error: null }),
  ]);
  const vendorLabels = new Map((vendorResult.data ?? []).map((vendor) => [vendor.id, vendor.legal_name]));
  const documentTypes: Record<string, string> = { invoice: "Factura", credit_note: "Nota de crédito", debit_note: "Nota de débito" };
  const now = new Date();
  const localDay = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Caracas", day: "2-digit" }).format(now));
  const localMonth = new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", month: "long", year: "numeric" }).format(now);
  const half = localDay <= 15 ? "Primera quincena" : "Segunda quincena";
  const allDocuments = (status?.total ?? 0) + (status?.issued ?? 0) + (status?.voided ?? 0);
  const statePercent = (count: number) => allDocuments ? Math.round((count / allDocuments) * 100) : 0;

  return <div className="page-content administration-dashboard">
    <div className="page-heading administration-dashboard-heading">
      <div><span className="eyebrow">Panel de control</span><h1>Tu operación, al día.</h1><p>Compras, proveedores y cierres de {localMonth}.</p></div>
      <div className="administration-dashboard-actions">
        {canSeeReports && <Link className="quiet-button" href="/administracion/reportes">Ver reportes</Link>}
        {canCreatePurchases && <Link className="primary-button" href="/administracion/compras">Nueva compra</Link>}
      </div>
    </div>

    <section className="administration-hero" aria-label="Período de referencia">
      <div><span>Período de referencia · {half}</span><h2>{localMonth}</h2>
        <p>Consulta documentos recientes y revisa el estado de la operación administrativa.</p></div>
      {canSeeDocuments && <Link href="/administracion/compras" className="administration-hero-link">Abrir compras <span aria-hidden="true">→</span></Link>}
    </section>

    {!canSeeDocuments ? <p className="administration-lock-note">Tus permisos no incluyen consulta de documentos administrativos; puedes usar las secciones asignadas desde el sidebar.</p> : status?.error ? <p className="error-message">No se pudo cargar el resumen de documentos.</p> : status && <>
      <section className="overview-grid administration-metrics" aria-label="Indicadores de Administración">
        <article className="overview-card"><span className="administration-metric-icon" aria-hidden="true">▤</span><h2>Documentos</h2><strong>{allDocuments}</strong><p>{status.voided} anulados · en todos los estados</p></article>
        <article className="overview-card"><span className="administration-metric-icon" aria-hidden="true">◷</span><h2>Borradores</h2><strong>{status.total}</strong><p>{status.invoices} facturas · {status.creditNotes + status.debitNotes} notas</p></article>
        <article className="overview-card"><span className="administration-metric-icon" aria-hidden="true">✓</span><h2>Documentos emitidos</h2><strong>{status.issued}</strong><p>Con snapshots fiscales y contables</p></article>
        <article className="overview-card"><span className="administration-metric-icon" aria-hidden="true">%</span><h2>Retenciones marcadas</h2><strong>{status.islrMarked + status.igtfMarked}</strong><p>ISLR e IGTF en borradores</p></article>
      </section>

      <div className="administration-summary-grid">
        <section className="work-card work-list administration-recent-documents">
          <div className="administration-panel-heading"><div><h2>Documentos recientes</h2><p>Últimas facturas y notas registradas</p></div>
            {canSeeDocuments && <Link className="text-link" href="/administracion/compras">Ver todos →</Link>}
          </div>
          {recentResult.error ? <p className="muted-note">No se pudo cargar la lista reciente.</p> : !recentResult.data?.length ? <p className="work-empty">Todavía no hay documentos.</p> :
            <div className="table-scroll administration-table-scroll"><table><thead><tr><th>Documento</th><th>Proveedor</th><th>Fecha</th><th>Período</th><th>Estado</th></tr></thead><tbody>
              {recentResult.data.map((document) => <tr key={document.id}>
                <td><Link href={`/administracion/compras/${document.id}`}>{documentTypes[document.document_type] ?? document.document_type} {document.invoice_number ? `Nº ${document.invoice_number}` : "sin número"}</Link></td>
                <td>{document.fiscal_vendor_id ? vendorLabels.get(document.fiscal_vendor_id) ?? "Proveedor fiscal" : "Sin proveedor"}</td>
                <td>{document.event_at ?? document.issued_at ?? "—"}</td>
                <td>{document.tax_period ? `${document.tax_period}${document.tax_half ? ` · Q${document.tax_half}` : ""}` : "Sin asignar"}</td>
                <td><span className={`administration-status administration-status-${document.status}`}>{document.status === "issued" ? "Emitido" : document.status === "voided" ? "Anulado" : "Borrador"}</span></td>
              </tr>)}
            </tbody></table></div>}
        </section>
        <aside className="work-card administration-period-panel">
          <div className="administration-panel-heading"><div><h2>Estado de documentos</h2><p>Distribución de registros existentes</p></div><span aria-hidden="true">▦</span></div>
          <div className="administration-period-stat"><span>Borradores</span><strong>{status.total}</strong><div><span style={{ width: `${statePercent(status.total)}%` }} /></div></div>
          <div className="administration-period-stat"><span>Emitidos</span><strong>{status.issued}</strong><div><span style={{ width: `${statePercent(status.issued)}%` }} /></div></div>
          <div className="administration-period-stat"><span>Anulados</span><strong>{status.voided}</strong><div><span style={{ width: `${statePercent(status.voided)}%` }} /></div></div>
          {canCreatePurchases && <Link href="/administracion/compras" className="administration-period-action">Nueva compra</Link>}
        </aside>
      </div>
    </>}
  </div>;
}
