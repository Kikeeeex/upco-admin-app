"use client";

import { useActionState } from "react";
import { createFiscalSettingsProposal, type FiscalSettingsActionState } from "@/features/administration/settings/actions";

const initial: FiscalSettingsActionState = { kind: "idle", message: "" };

function JsonField({ id, name, label, example }: { id: string; name: string; label: string; example: string }) {
  return <div className="field description-field"><label htmlFor={id}>{label} (JSON)</label><textarea id={id} name={name} rows={4} spellCheck={false} defaultValue={example} /></div>;
}

export function FiscalSettingsProposalForm() {
  const [state, action, pending] = useActionState(createFiscalSettingsProposal, initial);
  return <section className="work-card">
    <h2>Nueva propuesta</h2>
    <p className="administration-lock-note">Las propuestas son versiones de trabajo. No publican tasas, conceptos ni correlativos y no afectan compras ni retenciones.</p>
    <form action={action} className="work-form fiscal-settings-form">
      <div className="field"><label htmlFor="settings-label">Nombre de la propuesta</label><input id="settings-label" name="proposalLabel" required minLength={2} maxLength={160} placeholder="Revisión fiscal 2026" /></div>
      <div className="field"><label htmlFor="settings-company">Razón social de UPCO</label><input id="settings-company" name="companyName" required maxLength={200} /></div>
      <div className="field"><label htmlFor="settings-rif">RIF de UPCO</label><input id="settings-rif" name="companyRif" required maxLength={40} /></div>
      <div className="field description-field"><label htmlFor="settings-address">Dirección fiscal</label><textarea id="settings-address" name="companyAddress" required maxLength={1000} rows={2} /></div>
      <div className="field"><label htmlFor="settings-ut">Unidad Tributaria propuesta</label><input id="settings-ut" name="utAmount" required inputMode="decimal" /></div>
      <div className="field"><label htmlFor="settings-ut-date">Vigencia desde</label><input id="settings-ut-date" name="utEffectiveFrom" type="date" required /></div>
      <div className="field"><label htmlFor="settings-iva-general">IVA general (%)</label><input id="settings-iva-general" name="ivaGeneralRate" required inputMode="decimal" /></div>
      <div className="field"><label htmlFor="settings-iva-reduced">IVA reducido (%)</label><input id="settings-iva-reduced" name="ivaReducedRate" required inputMode="decimal" /></div>
      <p className="administration-lock-note description-field"><strong>Referencia pendiente:</strong> la entrega más reciente advierte posibles alícuotas adicionales. No se precarga ni activa ninguna tasa; registra aquí solo propuestas por revisar.</p>
      <JsonField id="settings-iva-additional" name="ivaAdditionalRates" label="Referencias de alícuotas IVA adicionales" example={'[]'} />
      <p className="administration-lock-note description-field"><strong>IGTF pendiente de validación:</strong> la entrega actual describe una tasa del 3 % sobre una base ingresada y su suma al neto. No es una regla aprobada ni se aplica desde esta propuesta.</p>
      <JsonField id="settings-igtf-reference" name="igtfReference" label="Referencia de regla IGTF" example={'{"source_reported_rate":3,"rate_status":"unverified","base_rule":"pending_validation","included_in_net_source_behavior":true}'} />
      <JsonField id="settings-islr" name="islrConcepts" label="Conceptos ISLR" example={'[{"code":"","name":"","rate":0,"taxable_base_percentage":100,"calculation":"flat"}]'} />
      <p className="administration-lock-note description-field">El paquete incluye un catálogo de 86 conceptos ISLR basado en una referencia técnica histórica. Esta cantidad y procedencia no certifican vigencia. Confirma los conceptos antes de proponer tasas o cálculos.</p>
      <JsonField id="settings-islr-source" name="islrCatalogueReference" label="Procedencia y revisión del catálogo ISLR" example={'{"source_count":86,"source_basis":"manual técnico histórico","review_status":"pending_tax_validation"}'} />
      <JsonField id="settings-cecos" name="cecos" label="Centros de costo" example={'[{"code":"","name":"","active":true}]'} />
      <JsonField id="settings-accounts" name="paymentAccounts" label="Cuentas de pago" example={'[{"code":"","name":"","active":true}]'} />
      <JsonField id="settings-sequences" name="sequences" label="Correlativos propuestos" example={'[{"tax":"iva","period":"2026-11","half":1,"next_number":1}]'} />
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar propuesta"}</button>
    </form>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </section>;
}
