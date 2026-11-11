"use client";

import { useActionState } from "react";
import { createFiscalVendor, updateFiscalVendor, type FiscalVendorActionState } from "@/features/administration/vendors/actions";

type FiscalVendorFormData = {
  id?: string;
  legal_name: string;
  tax_identifier: string;
  tax_address: string;
  taxpayer_type: string | null;
  person_type: "natural" | "legal";
  residency: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  iva_retention_rate: number;
  fiscal_machine_numbers: string | null;
  active: boolean;
  review_state: "needs_review" | "confirmed";
  review_notes: string | null;
};

const initial: FiscalVendorActionState = { kind: "idle", message: "" };

function Fields({ vendor }: { vendor?: FiscalVendorFormData }) {
  return <>
    {vendor?.id && <input type="hidden" name="id" value={vendor.id} />}
    <div className="field"><label htmlFor={`fiscal-name-${vendor?.id ?? "new"}`}>Razón social</label><input id={`fiscal-name-${vendor?.id ?? "new"}`} name="legalName" required maxLength={200} defaultValue={vendor?.legal_name ?? ""} /></div>
    <div className="field"><label htmlFor={`fiscal-rif-${vendor?.id ?? "new"}`}>RIF</label><input id={`fiscal-rif-${vendor?.id ?? "new"}`} name="taxIdentifier" required maxLength={40} defaultValue={vendor?.tax_identifier ?? ""} /></div>
    <div className="field description-field"><label htmlFor={`fiscal-address-${vendor?.id ?? "new"}`}>Dirección fiscal</label><textarea id={`fiscal-address-${vendor?.id ?? "new"}`} name="taxAddress" required maxLength={1000} rows={3} defaultValue={vendor?.tax_address ?? ""} /></div>
    <div className="field"><label htmlFor={`fiscal-person-${vendor?.id ?? "new"}`}>Tipo de persona</label><select id={`fiscal-person-${vendor?.id ?? "new"}`} name="personType" defaultValue={vendor?.person_type ?? "legal"}><option value="legal">Jurídica</option><option value="natural">Natural</option></select></div>
    <div className="field"><label htmlFor={`fiscal-taxpayer-${vendor?.id ?? "new"}`}>Tipo de contribuyente</label><input id={`fiscal-taxpayer-${vendor?.id ?? "new"}`} name="taxpayerType" maxLength={120} defaultValue={vendor?.taxpayer_type ?? ""} /></div>
    <div className="field"><label htmlFor={`fiscal-residency-${vendor?.id ?? "new"}`}>Residencia fiscal</label><input id={`fiscal-residency-${vendor?.id ?? "new"}`} name="residency" maxLength={80} defaultValue={vendor?.residency ?? ""} /></div>
    <div className="field"><label htmlFor={`fiscal-retention-${vendor?.id ?? "new"}`}>Retención IVA</label><select id={`fiscal-retention-${vendor?.id ?? "new"}`} name="ivaRetentionRate" defaultValue={String(vendor?.iva_retention_rate ?? 75)}><option value="0">0 %</option><option value="75">75 %</option><option value="100">100 %</option></select></div>
    <div className="field"><label htmlFor={`fiscal-contact-${vendor?.id ?? "new"}`}>Contacto</label><input id={`fiscal-contact-${vendor?.id ?? "new"}`} name="contactName" maxLength={200} defaultValue={vendor?.contact_name ?? ""} /></div>
    <div className="field"><label htmlFor={`fiscal-phone-${vendor?.id ?? "new"}`}>Teléfono</label><input id={`fiscal-phone-${vendor?.id ?? "new"}`} name="contactPhone" maxLength={80} defaultValue={vendor?.contact_phone ?? ""} /></div>
    <div className="field"><label htmlFor={`fiscal-email-${vendor?.id ?? "new"}`}>Correo</label><input id={`fiscal-email-${vendor?.id ?? "new"}`} name="contactEmail" type="email" maxLength={254} defaultValue={vendor?.contact_email ?? ""} /></div>
    <div className="field description-field"><label htmlFor={`fiscal-machines-${vendor?.id ?? "new"}`}>Números de máquinas fiscales</label><textarea id={`fiscal-machines-${vendor?.id ?? "new"}`} name="fiscalMachineNumbers" maxLength={2000} rows={2} defaultValue={vendor?.fiscal_machine_numbers ?? ""} /></div>
    <div className="field"><label htmlFor={`fiscal-review-${vendor?.id ?? "new"}`}>Revisión</label><select id={`fiscal-review-${vendor?.id ?? "new"}`} name="reviewState" defaultValue={vendor?.review_state ?? "needs_review"}><option value="needs_review">Por revisar</option><option value="confirmed">Confirmado</option></select></div>
    <div className="field description-field"><label htmlFor={`fiscal-notes-${vendor?.id ?? "new"}`}>Notas de revisión</label><textarea id={`fiscal-notes-${vendor?.id ?? "new"}`} name="reviewNotes" maxLength={2000} rows={2} defaultValue={vendor?.review_notes ?? ""} /></div>
    <label className="check-field"><input name="active" type="checkbox" defaultChecked={vendor?.active ?? true} /> Proveedor activo</label>
  </>;
}

export function CreateFiscalVendorForm() {
  const [state, action, pending] = useActionState(createFiscalVendor, initial);
  return <section className="work-card"><h2>Nuevo proveedor fiscal</h2><form action={action} className="work-form fiscal-vendor-form">
    <Fields />
    <button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar proveedor"}</button>
  </form>{state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}</section>;
}

export function EditFiscalVendorForm({ vendor }: { vendor: FiscalVendorFormData }) {
  const [state, action, pending] = useActionState(updateFiscalVendor, initial);
  return <form action={action} className="work-form fiscal-vendor-form">
    <Fields vendor={vendor} />
    <button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}
