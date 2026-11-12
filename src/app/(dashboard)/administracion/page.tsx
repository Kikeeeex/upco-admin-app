import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { loadAdministrationDraftStatus } from "@/features/administration/reports/status";
import { hasAnyAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

const sections = [
  { href: "/administracion/compras", title: "Compras y documentos", description: "Facturas recibidas, notas y borradores de compra.", permissions: ["purchases.read", "purchases.manage"] },
  { href: "/administracion/proveedores", title: "Proveedores", description: "Directorio fiscal separado de Procura.", permissions: ["vendors.read", "vendors.manage"] },
  { href: "/administracion/retenciones", title: "Retenciones", description: "Revisión de retenciones IVA, ISLR e IGTF.", permissions: ["retentions.read"] },
  { href: "/administracion/libros", title: "Libros y cierres", description: "Libros y estados de conciliación por período.", permissions: ["books.read"] },
  { href: "/administracion/importaciones", title: "Importaciones", description: "Vista previa de proveedores y documentos históricos.", permissions: ["imports.validate"] },
  { href: "/administracion/reportes", title: "Reportes y exportaciones", description: "TXT quincenal IVA y XML mensual ISLR para revisión.", permissions: ["reports.export"] },
  { href: "/administracion/configuracion-fiscal", title: "Configuración fiscal", description: "Configuraciones versionadas; activación auditada.", permissions: ["fiscal_settings.read", "fiscal_settings.manage"] },
] as const;

export default async function AdministrationPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["purchases.read", "purchases.manage", "vendors.read", "vendors.manage", "retentions.read", "books.read", "imports.validate", "reports.export", "fiscal_settings.read", "fiscal_settings.manage"]);
  const canSeeDocuments = hasAnyAdministrationPermission(access, ["purchases.read", "purchases.manage", "retentions.read", "books.read", "imports.validate", "reports.export"]);
  const canSeeVendors = hasAnyAdministrationPermission(access, ["vendors.read", "vendors.manage", "purchases.read", "purchases.manage", "imports.validate", "reports.export"]);
  const [status, recentResult, vendorResult] = await Promise.all([
    canSeeDocuments ? loadAdministrationDraftStatus(access) : Promise.resolve(null),
    canSeeDocuments ? access.supabase.from("administration_documents")
      .select("id, invoice_number, document_type, fiscal_vendor_id, event_at, issued_at, tax_period, tax_half")
      .eq("organization_id", access.organizationId).eq("status", "draft").order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [], error: null }),
    canSeeVendors ? access.supabase.from("fiscal_vendors").select("id, legal_name").eq("organization_id", access.organizationId).limit(200) : Promise.resolve({ data: [], error: null }),
  ]);
  const vendorLabels = new Map((vendorResult.data ?? []).map((vendor) => [vendor.id, vendor.legal_name]));
  const documentTypes: Record<string, string> = { invoice: "Factura", credit_note: "Nota de crédito", debit_note: "Nota de débito" };
  const now = new Date();
  const localDay = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Caracas", day: "2-digit" }).format(now));
  const localMonth = new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", month: "long", year: "numeric" }).format(now);
  const half = localDay <= 15 ? "1.ª quincena" : "2.ª quincena";
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ADMINISTRACIÓN V2.8</span><h1>Resumen</h1><p>Compras, proveedores, retenciones y cierres en un solo espacio.</p></div>
    <section className="work-card administration-rollout-note">
      <span className="badge">Implementación por etapas</span>
      <p>Contabilidad aprobó las reglas y formatos fuente. Emisión, PDF, anulación, exportaciones e importación transaccional están disponibles para administradores. El acceso de miembros depende de permisos explícitos.</p>
    </section>
    <section className="work-card">
      <h2>Período de referencia</h2>
      <p><strong>{localMonth} · {half}</strong></p>
      <p className="muted-note">Se calcula desde la fecha actual de Caracas solo para orientar la navegación. No asigna ni valida el período fiscal de ningún documento.</p>
    </section>
    {!canSeeDocuments ? <p className="administration-lock-note">Tus permisos no incluyen consulta de documentos administrativos; puedes acceder a las secciones asignadas abajo.</p> : status?.error ? <p className="error-message">No se pudo cargar el resumen de borradores. Aplica las migraciones locales de Administración V2.</p> : status && <section className="overview-grid administration-metrics" aria-label="Estado de borradores">
      <article className="overview-card"><span className="badge">{status.total}</span><h2>Borradores</h2><p>Documentos pendientes de emisión.</p><Link href="/administracion/compras">Ver compras →</Link></article>
      <article className="overview-card"><span className="badge">{status.issued}</span><h2>Emitidos</h2><p>Documentos con snapshots fiscales y contables.</p></article>
      <article className="overview-card"><span className="badge">{status.invoices}</span><h2>Facturas</h2><p>Facturas recibidas en borrador.</p></article>
      <article className="overview-card"><span className="badge">{status.creditNotes + status.debitNotes}</span><h2>Notas</h2><p>Crédito: {status.creditNotes} · débito: {status.debitNotes}</p></article>
      <article className="overview-card"><span className="badge">{status.islrMarked + status.igtfMarked}</span><h2>Marcas de retención</h2><p>Indicadores en borradores.</p><Link href="/administracion/retenciones">Revisar estado →</Link></article>
    </section>}
    {canSeeDocuments && <section className="work-card work-list">
      <h2>Borradores recientes</h2>
      {recentResult.error ? <p className="muted-note">No se pudo cargar la lista reciente.</p> : !recentResult.data?.length ? <p className="work-empty">Todavía no hay documentos borrador.</p> :
        <div className="table-scroll"><table><thead><tr><th>Tipo</th><th>Documento</th><th>Proveedor</th><th>Fecha</th><th>Período</th><th></th></tr></thead><tbody>
          {recentResult.data.map((document) => <tr key={document.id}>
            <td>{documentTypes[document.document_type] ?? document.document_type}</td>
            <td>{document.invoice_number || "Sin número"}</td>
            <td>{document.fiscal_vendor_id ? vendorLabels.get(document.fiscal_vendor_id) ?? "Proveedor fiscal" : "Sin proveedor"}</td>
            <td>{document.event_at ?? document.issued_at ?? "—"}</td>
            <td>{document.tax_period ? `${document.tax_period}${document.tax_half ? ` · Q${document.tax_half}` : ""}` : "Sin asignar"}</td>
            <td><Link className="text-link" href={`/administracion/compras/${document.id}`}>Abrir</Link></td>
          </tr>)}
        </tbody></table></div>}
    </section>}
    <div className="administration-module-grid">
      {sections.filter((section) => hasAnyAdministrationPermission(access, section.permissions)).map((section) => <Link className="overview-card" href={section.href} key={section.href}>
        <span className="card-glyph" aria-hidden="true">▧</span><h2>{section.title}</h2><p>{section.description}</p><span className="text-link">Abrir →</span>
      </Link>)}
    </div>
  </div>;
}
