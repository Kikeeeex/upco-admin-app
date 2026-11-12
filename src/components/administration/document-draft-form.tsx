"use client";

import { useActionState, useState } from "react";
import { createAdministrationDraft, updateAdministrationDraft, type AdministrationDraftActionState } from "@/features/administration/documents/actions";
import { ISLR_CONCEPTS } from "@/features/administration/documents/islr-concepts";

type VendorOption = { id: string; legal_name: string; active: boolean; review_state: string; iva_retention_rate: number };
type InvoiceOption = { id: string; invoice_number: string | null; issued_at: string | null; fiscal_vendor_id: string | null };
export type DraftInitial = {
  id: string; fiscal_vendor_id: string | null; document_type: "invoice" | "credit_note" | "debit_note";
  invoice_number: string | null; control_number: string | null; issued_at: string | null; event_at: string | null;
  tax_period: string | null; tax_half: number | null; period_override_reason: string | null; affected_document_id: string | null;
  description: string; exempt_cents: number; base16_cents: number; base8_cents: number; igtf_applies: boolean;
  iva_retention_rate: number; iva_retention_reason: string | null; igtf_base_cents: number; islr_applies: boolean; islr_concept_code: string | null; islr_base_cents: number;
  islr_manual_cents: number | null; islr_manual_reason: string | null; islr_manual_rate: number | null; islr_manual_subtraction_cents: number; payment_account_label: string | null; ceco_allocation_note: string | null;
};
const initial: AdministrationDraftActionState = { kind: "idle", message: "" };

function money(cents?: number | null) { return cents == null ? "" : (cents / 100).toFixed(2); }

export function AdministrationDraftForm({ vendors, invoices, draft, canIssue = false }: { vendors: VendorOption[]; invoices: InvoiceOption[]; draft?: DraftInitial; canIssue?: boolean }) {
  const [state, action, pending] = useActionState(draft ? updateAdministrationDraft : createAdministrationDraft, initial);
  const [selectedVendorId, setSelectedVendorId] = useState(draft?.fiscal_vendor_id ?? "");
  const [selectedAffectedId, setSelectedAffectedId] = useState(draft?.affected_document_id ?? "");
  const [ivaRetentionRate, setIvaRetentionRate] = useState(String(draft?.iva_retention_rate ?? vendors.find((vendor) => vendor.id === (draft?.fiscal_vendor_id ?? ""))?.iva_retention_rate ?? 75));
  const availableInvoices = invoices.filter((invoice) => invoice.fiscal_vendor_id === selectedVendorId);
  return <section className="work-card">
    <h2>{draft ? "Editar borrador" : "Nuevo borrador"}</h2>
    <p className="administration-lock-note">La vista previa aplica las reglas aprobadas usando la configuración fiscal activa. Solo guardar conserva la captura; no emite, numera ni guarda los resultados calculados.</p>
    <form action={action} className="work-form draft-document-form">
      {draft && <input type="hidden" name="id" value={draft.id} />}
      <div className="field"><label htmlFor="draft-type">Tipo de documento</label><select id="draft-type" name="documentType" defaultValue={draft?.document_type ?? "invoice"}><option value="invoice">Factura</option><option value="credit_note">Nota de crédito</option><option value="debit_note">Nota de débito</option></select></div>
      <div className="field"><label htmlFor="draft-vendor">Proveedor fiscal</label><select id="draft-vendor" name="fiscalVendorId" value={selectedVendorId} onChange={(event) => { const nextVendorId = event.target.value; setSelectedVendorId(nextVendorId); setIvaRetentionRate(String(vendors.find((vendor) => vendor.id === nextVendorId)?.iva_retention_rate ?? 75)); if (!invoices.some((invoice) => invoice.id === selectedAffectedId && invoice.fiscal_vendor_id === nextVendorId)) setSelectedAffectedId(""); }}><option value="">Sin seleccionar</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.legal_name}{!vendor.active ? " · inactivo" : vendor.review_state !== "confirmed" ? " · por revisar" : ""}</option>)}</select></div>
      <div className="field"><label htmlFor="draft-number">Número de factura</label><input id="draft-number" name="invoiceNumber" maxLength={80} defaultValue={draft?.invoice_number ?? ""} /></div>
      <div className="field"><label htmlFor="draft-control">Número de control</label><input id="draft-control" name="controlNumber" maxLength={80} defaultValue={draft?.control_number ?? ""} /></div>
      <div className="field"><label htmlFor="draft-issued">Fecha de emisión</label><input id="draft-issued" name="issuedAt" type="date" defaultValue={draft?.issued_at ?? ""} /></div>
      <div className="field"><label htmlFor="draft-event">Fecha de pago o abono</label><input id="draft-event" name="eventAt" type="date" defaultValue={draft?.event_at ?? ""} /></div>
      <div className="field"><label htmlFor="draft-period">Período</label><input id="draft-period" name="taxPeriod" type="month" defaultValue={draft?.tax_period ?? ""} /></div>
      <div className="field"><label htmlFor="draft-half">Quincena</label><select id="draft-half" name="taxHalf" defaultValue={draft?.tax_half ? String(draft.tax_half) : ""}><option value="">Sin asignar</option><option value="1">1–15</option><option value="2">16–fin de mes</option></select></div>
      <div className="field description-field"><label htmlFor="draft-period-reason">Motivo si se difiere el período</label><input id="draft-period-reason" name="periodOverrideReason" maxLength={1000} defaultValue={draft?.period_override_reason ?? ""} /></div>
      <div className="field description-field"><label htmlFor="draft-description">Descripción</label><textarea id="draft-description" name="description" required minLength={10} maxLength={2000} rows={3} defaultValue={draft?.description ?? ""} /></div>
      <div className="field"><label htmlFor="draft-exempt">Monto exento (Bs.)</label><input id="draft-exempt" name="exempt" inputMode="decimal" defaultValue={money(draft?.exempt_cents) || "0"} /></div>
      <div className="field"><label htmlFor="draft-base16">Base 16 % (Bs.)</label><input id="draft-base16" name="base16" inputMode="decimal" defaultValue={money(draft?.base16_cents) || "0"} /></div>
      <div className="field"><label htmlFor="draft-base8">Base 8 % (Bs.)</label><input id="draft-base8" name="base8" inputMode="decimal" defaultValue={money(draft?.base8_cents) || "0"} /></div>
      <div className="field"><label htmlFor="draft-iva-retention">Retención IVA (%)</label><select id="draft-iva-retention" name="ivaRetentionRate" value={ivaRetentionRate} onChange={(event) => setIvaRetentionRate(event.target.value)}><option value="0">0 %</option><option value="75">75 %</option><option value="100">100 %</option></select></div>
      <div className="field description-field"><label htmlFor="draft-iva-reason">Motivo o causal de retención IVA</label><input id="draft-iva-reason" name="ivaRetentionReason" maxLength={1000} defaultValue={draft?.iva_retention_reason ?? ""} placeholder="Obligatorio para 0 % y 100 % cuando corresponda" /></div>
      <div className="field"><label htmlFor="draft-affected">Factura afectada</label><select id="draft-affected" name="affectedDocumentId" value={selectedAffectedId} onChange={(event) => setSelectedAffectedId(event.target.value)}><option value="">Sin seleccionar</option>{availableInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number || "Sin número"}{invoice.issued_at ? ` · ${invoice.issued_at}` : ""}</option>)}</select></div>
      <div className="field"><label htmlFor="draft-igtf-base">Base IGTF (Bs.)</label><input id="draft-igtf-base" name="igtfBase" inputMode="decimal" defaultValue={money(draft?.igtf_base_cents) || "0"} /></div>
      <label className="check-field"><input name="igtfApplies" type="checkbox" defaultChecked={draft?.igtf_applies ?? false} /> Aplica IGTF a este pago (3 % de la base indicada)</label>
      <div className="field description-field"><label htmlFor="draft-islr-concept">Concepto ISLR</label><select id="draft-islr-concept" name="islrConceptCode" defaultValue={draft?.islr_concept_code ?? ""}><option value="">Sin concepto</option>{ISLR_CONCEPTS.map((concept) => <option key={concept.code} value={concept.code}>{concept.code} · {concept.description}{concept.beneficiary ? ` · ${concept.beneficiary}` : ""}</option>)}</select></div>
      <div className="field"><label htmlFor="draft-islr-base">Base ISLR (Bs.)</label><input id="draft-islr-base" name="islrBase" inputMode="decimal" defaultValue={money(draft?.islr_base_cents) || "0"} /></div>
      <div className="field"><label htmlFor="draft-islr-manual">ISLR manual (Bs.)</label><input id="draft-islr-manual" name="islrManual" inputMode="decimal" defaultValue={money(draft?.islr_manual_cents)} /></div>
      <div className="field"><label htmlFor="draft-islr-rate">Alícuota de cálculo manual ISLR (%)</label><input id="draft-islr-rate" name="islrRate" inputMode="decimal" defaultValue={draft?.islr_manual_rate?.toString() ?? ""} /></div>
      <div className="field"><label htmlFor="draft-islr-subtraction">Sustraendo manual ISLR (Bs.)</label><input id="draft-islr-subtraction" name="islrSubtraction" inputMode="decimal" defaultValue={money(draft?.islr_manual_subtraction_cents) || "0"} /></div>
      <div className="field description-field"><label htmlFor="draft-islr-reason">Motivo del monto manual</label><input id="draft-islr-reason" name="islrManualReason" maxLength={1000} defaultValue={draft?.islr_manual_reason ?? ""} /></div>
      <label className="check-field"><input name="islrApplies" type="checkbox" defaultChecked={draft?.islr_applies ?? false} /> Aplica retención ISLR</label>
      <div className="field"><label htmlFor="draft-account">Cuenta de pago (referencia)</label><input id="draft-account" name="paymentAccountLabel" maxLength={200} defaultValue={draft?.payment_account_label ?? ""} /></div>
      <div className="field description-field"><label htmlFor="draft-ceco">Distribución CECO</label><textarea id="draft-ceco" name="cecoAllocationNote" maxLength={2000} rows={2} placeholder="ADM:60;OPS:40" defaultValue={draft?.ceco_allocation_note ?? ""} /><small>Formato de referencia; los porcentajes deben ser positivos y sumar 100 %. No se valida aquí si los códigos están activos.</small></div>
      <button className="quiet-button" type="submit" name="intent" value="calculate" disabled={pending}>{pending ? "Calculando…" : "Calcular vista previa"}</button>
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : draft ? "Guardar cambios" : "Guardar borrador"}</button>
      {draft && canIssue && <button className="primary-button" type="submit" name="intent" value="issue" disabled={pending}>Emitir documento</button>}
    </form>
    {state.preview && <section className="work-card administration-calculation-preview" aria-label="Vista previa de cálculo"><h3>Resultado de vista previa</h3><dl className="detail-grid">
      <div><dt>Exento</dt><dd>Bs. {state.preview.exempt}</dd></div><div><dt>IVA 16 %</dt><dd>Bs. {state.preview.iva16}</dd></div><div><dt>IVA 8 %</dt><dd>Bs. {state.preview.iva8}</dd></div>
      <div><dt>Subtotal</dt><dd>Bs. {state.preview.subtotal}</dd></div><div><dt>Total facturado</dt><dd>Bs. {state.preview.total}</dd></div><div><dt>IVA retenido</dt><dd>Bs. {state.preview.ivaRetained}</dd></div>
      <div><dt>IGTF</dt><dd>Bs. {state.preview.igtf}</dd></div><div><dt>ISLR retenido</dt><dd>Bs. {state.preview.islrRetained}</dd></div><div><dt>Neto a pagar</dt><dd>Bs. {state.preview.netPayable}</dd></div>
    </dl></section>}
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </section>;
}
