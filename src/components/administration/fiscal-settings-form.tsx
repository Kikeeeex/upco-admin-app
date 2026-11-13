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
      <div className="field description-field"><label htmlFor="settings-label">Nombre de la propuesta</label><input id="settings-label" name="proposalLabel" required minLength={2} maxLength={160} placeholder="Configuración fiscal 2026" /></div>
      <fieldset id="settings-company-group" className="fiscal-settings-group description-field"><legend>Agente de retención y parámetros fiscales</legend>
        <div className="fiscal-settings-group-grid">
          <div className="field"><label htmlFor="settings-company">Razón social de UPCO</label><input id="settings-company" name="companyName" required maxLength={200} /></div>
          <div className="field"><label htmlFor="settings-rif">RIF de UPCO</label><input id="settings-rif" name="companyRif" required maxLength={40} /></div>
          <div className="field description-field"><label htmlFor="settings-address">Dirección fiscal</label><textarea id="settings-address" name="companyAddress" required maxLength={1000} rows={2} /></div>
          <div className="field"><label htmlFor="settings-ut">Unidad Tributaria</label><input id="settings-ut" name="utAmount" required inputMode="decimal" /></div>
          <div className="field"><label htmlFor="settings-ut-date">Vigencia desde</label><input id="settings-ut-date" name="utEffectiveFrom" type="date" required /></div>
          <div className="field"><label htmlFor="settings-iva-general">IVA general (%)</label><input id="settings-iva-general" name="ivaGeneralRate" required inputMode="decimal" /></div>
          <div className="field"><label htmlFor="settings-iva-reduced">IVA reducido (%)</label><input id="settings-iva-reduced" name="ivaReducedRate" required inputMode="decimal" /></div>
        </div>
        <p className="administration-lock-note">Reglas aprobadas: IVA al 16 % y 8 %. IGTF al 3 % sobre la base indicada, incorporado al neto a pagar.</p>
        <JsonField id="settings-iva-additional" name="ivaAdditionalRates" label="Referencias IVA adicionales (no incluidas en la regla aprobada)" example={'[]'} />
        <JsonField id="settings-igtf-reference" name="igtfReference" label="Referencia de regla IGTF" example={'{"rate_percent":3,"base_rule":"user_entered_base","included_in_net":true,"approval_status":"approved"}'} />
      </fieldset>
      <fieldset id="settings-islr-group" className="fiscal-settings-group description-field"><legend>Conceptos ISLR</legend>
        <p className="muted-note">El catálogo aprobado de 86 conceptos está documentado en la entrega UPCO Compras y admite tasa, base sujeta, sustraendo y overrides según cada concepto.</p>
        <JsonField id="settings-islr" name="islrConcepts" label="Catálogo y ajustes ISLR" example={'[{"code":"","name":"","rate":0,"taxable_base_percentage":100,"calculation":"flat"}]'} />
        <JsonField id="settings-islr-source" name="islrCatalogueReference" label="Referencia del catálogo ISLR" example={'{"source_count":86,"source_basis":"UPCO Compras entrega integral","review_status":"approved"}'} />
      </fieldset>
      <fieldset id="settings-catalogs-group" className="fiscal-settings-group description-field"><legend>Catálogos contables</legend>
        <div className="fiscal-settings-group-grid"><JsonField id="settings-cecos" name="cecos" label="Centros de costo" example={'[{"code":"","name":"","active":true}]'} /><JsonField id="settings-accounts" name="paymentAccounts" label="Cuentas de pago" example={'[{"code":"","name":"","active":true}]'} /></div>
      </fieldset>
      <fieldset id="settings-sequences-group" className="fiscal-settings-group description-field"><legend>Correlativos de comprobantes</legend>
        <p className="muted-note">Se mantienen correlativos continuos para IVA e ISLR; cada emisión conserva una copia de la configuración usada.</p>
        <JsonField id="settings-sequences" name="sequences" label="Correlativos propuestos" example={'[{"tax":"iva","period":"2026-11","half":1,"next_number":1},{"tax":"islr","period":"2026-11","half":1,"next_number":1}]'} />
      </fieldset>
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar propuesta"}</button>
    </form>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </section>;
}
