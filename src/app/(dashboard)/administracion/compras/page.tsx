import { AdministrationDraftForm } from "@/components/administration/document-draft-form";
import { getAccessContext } from "@/features/auth/access";
import Link from "next/link";

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ emision?: string }> }) {
  const params = await searchParams;
  return <ComprasContent issued={params.emision === "ok"} />;
}

async function ComprasContent({ issued }: { issued: boolean }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  const [documentsResult, vendorsResult] = await Promise.all([
    access.supabase.from("administration_documents")
      .select("id, fiscal_vendor_id, document_type, invoice_number, issued_at, event_at, tax_period, tax_half, status, created_at")
      .eq("organization_id", access.organizationId).order("created_at", { ascending: false }).limit(50),
    access.supabase.from("fiscal_vendors").select("id, legal_name, active, review_state, iva_retention_rate")
      .eq("organization_id", access.organizationId).order("legal_name").limit(200),
  ]);
  const rows = documentsResult.data ?? [];
  const vendorRows = vendorsResult.data ?? [];
  const vendorLabels = new Map(vendorRows.map((vendor) => [vendor.id, vendor.legal_name]));
  const invoices = rows.filter((row) => row.document_type === "invoice").map((row) => ({ id: row.id, invoice_number: row.invoice_number, issued_at: row.issued_at, fiscal_vendor_id: row.fiscal_vendor_id }));
  const typeLabels: Record<string, string> = { invoice: "Factura", credit_note: "Nota de crédito", debit_note: "Nota de débito" };
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ADMINISTRACIÓN V2.6</span><h1>Compras y documentos</h1><p>Registra facturas recibidas y notas de crédito o débito.</p></div>
    {issued && <p className="success-message" role="status">Documento emitido con cálculo, configuración y distribución contable inmutables.</p>}
    {access.role === "admin" && !vendorsResult.error && <AdministrationDraftForm vendors={vendorRows} invoices={invoices} />}
    <section className="work-card work-list">
      <h2>Documentos recientes</h2>
      {documentsResult.error ? <p className="error-message" role="alert">No se pudo cargar la lista. Aplica las migraciones de Administración V2.</p> : rows.length === 0 ?
        <p className="work-empty">Aún no hay documentos.</p> :
        <div className="table-scroll"><table><thead><tr><th>Tipo</th><th>Documento</th><th>Proveedor</th><th>Fecha</th><th>Período</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}><td>{typeLabels[row.document_type] ?? row.document_type}</td><td>{row.invoice_number ?? "Sin número"}</td><td>{row.fiscal_vendor_id ? vendorLabels.get(row.fiscal_vendor_id) ?? "Proveedor fiscal" : "Sin seleccionar"}</td><td>{row.event_at ?? row.issued_at ?? "—"}</td><td>{row.tax_period ? `${row.tax_period}${row.tax_half ? ` · Q${row.tax_half}` : ""}` : "Sin asignar"}</td><td><span className="badge">{row.status === "issued" ? "Emitido" : row.status === "voided" ? "Anulado" : "Borrador"}</span></td><td><Link className="text-link" href={`/administracion/compras/${row.id}`}>{row.status === "draft" ? "Abrir" : "Ver"}</Link></td></tr>)}
        </tbody></table></div>}
      {vendorsResult.error && <p className="error-message">No se pudo cargar el directorio fiscal para crear borradores.</p>}
      {!documentsResult.error && rows.length === 50 && <p className="muted-note">Se muestran los 50 documentos más recientes.</p>}
    </section>
  </div>;
}
