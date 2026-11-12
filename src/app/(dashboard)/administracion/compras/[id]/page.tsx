import Link from "next/link";
import { notFound } from "next/navigation";
import { AdministrationDraftForm } from "@/components/administration/document-draft-form";
import { getAccessContext } from "@/features/auth/access";
import { VoidDocumentForm } from "@/components/administration/void-document-form";
import { hasAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

const draftFields = "id, fiscal_vendor_id, document_type, invoice_number, control_number, issued_at, event_at, tax_period, tax_half, period_override_reason, affected_document_id, description, exempt_cents, base16_cents, base8_cents, iva_retention_rate, iva_retention_reason, igtf_applies, igtf_base_cents, islr_applies, islr_concept_code, islr_base_cents, islr_manual_cents, islr_manual_reason, islr_manual_rate, islr_manual_subtraction_cents, payment_account_label, ceco_allocation_note, status, calculation_snapshot, settings_snapshot, accounting_snapshot, iva_certificate_number, islr_certificate_number, void_reason, voided_at";

export default async function EditarBorradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["purchases.read", "purchases.manage"]);
  const canManage = hasAdministrationPermission(access, "purchases.manage");
  const [{ data: draft }, { data: vendors }, { data: invoices }] = await Promise.all([
    access.supabase.from("administration_documents").select(draftFields).eq("id", id).eq("organization_id", access.organizationId).maybeSingle(),
    canManage ? access.supabase.from("fiscal_vendors").select("id, legal_name, active, review_state, iva_retention_rate").eq("organization_id", access.organizationId).order("legal_name").limit(200) : Promise.resolve({ data: [], error: null }),
    canManage ? access.supabase.from("administration_documents").select("id, invoice_number, issued_at, fiscal_vendor_id").eq("organization_id", access.organizationId).eq("document_type", "invoice").order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
  ]);
  if (!draft) notFound();
  if (draft.status === "issued" || draft.status === "voided") {
    const calculation = draft.calculation_snapshot && typeof draft.calculation_snapshot === "object" ? draft.calculation_snapshot as Record<string, unknown> : {};
    const accounting = draft.accounting_snapshot && typeof draft.accounting_snapshot === "object" ? draft.accounting_snapshot as Record<string, unknown> : {};
    return <div className="page-content">
      <div className="page-heading"><span className="eyebrow">REGISTRO DOCUMENTAL · {draft.status === "voided" ? "ANULADO" : "EMITIDO"}</span><h1>{draft.status === "voided" ? "Documento anulado" : "Documento emitido"}</h1><p>Esta operación conserva el cálculo, la configuración y la distribución contable usados al emitir.</p></div>
      <Link className="text-link" href="/administracion/compras">← Volver a Compras y documentos</Link>
      <section className="work-card"><h2>{draft.invoice_number ?? "Documento"}</h2><dl className="detail-grid">
        <div><dt>Comprobante IVA</dt><dd>{draft.iva_certificate_number ?? "Sin retención IVA"}</dd></div>
        <div><dt>Comprobante ISLR</dt><dd>{draft.islr_certificate_number ?? "Sin retención ISLR"}</dd></div>
        <div><dt>Total</dt><dd>Bs. {((Number(calculation.totalCents ?? 0)) / 100).toFixed(2)}</dd></div>
        <div><dt>IVA retenido</dt><dd>Bs. {((Number(calculation.ivaRetentionCents ?? 0)) / 100).toFixed(2)}</dd></div>
        <div><dt>IGTF</dt><dd>Bs. {((Number(calculation.igtfAmountCents ?? 0)) / 100).toFixed(2)}</dd></div>
        <div><dt>ISLR retenido</dt><dd>Bs. {((Number(calculation.islrRetentionCents ?? 0)) / 100).toFixed(2)}</dd></div>
        <div><dt>Neto a pagar</dt><dd>Bs. {((Number(calculation.netPayableCents ?? 0)) / 100).toFixed(2)}</dd></div>
        <div><dt>Cuenta de pago</dt><dd>{String((accounting.paymentAccount as Record<string, unknown> | undefined)?.name ?? "—")}</dd></div>
        <div><dt>Distribución CECO</dt><dd>{String(calculation.ceco ?? "—")}</dd></div>
      </dl></section>
      {draft.status === "issued" && access.role === "admin" && (draft.iva_certificate_number || draft.islr_certificate_number) && <section className="work-card">
        <h2>Comprobantes PDF</h2>
        <div className="administration-document-downloads">
          {draft.iva_certificate_number && <a className="text-link" href={`/api/administracion/compras/${draft.id}/pdf?tipo=iva`}>Descargar comprobante IVA · {draft.iva_certificate_number}</a>}
          {draft.islr_certificate_number && <a className="text-link" href={`/api/administracion/compras/${draft.id}/pdf?tipo=islr`}>Descargar comprobante ISLR · {draft.islr_certificate_number}</a>}
        </div>
      </section>}
      {draft.status === "voided" && <section className="work-card"><h2>Motivo de anulación</h2><p>{draft.void_reason}</p></section>}
      {draft.status === "issued" && access.role === "admin" && <VoidDocumentForm documentId={draft.id} />}
    </div>;
  }
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">REGISTRO DOCUMENTAL · BORRADOR</span><h1>Editar borrador</h1><p>Puedes obtener una vista previa fiscal; solo los datos de captura se guardan. No se emite ni asigna correlativo.</p></div>
    <Link className="text-link" href="/administracion/compras">← Volver a Compras y documentos</Link>
    {canManage ? <AdministrationDraftForm draft={draft} vendors={vendors ?? []} invoices={invoices ?? []} canIssue={access.role === "admin"} /> : <p className="administration-lock-note">Tienes acceso de lectura. La edición de borradores requiere permiso de gestión.</p>}
  </div>;
}
