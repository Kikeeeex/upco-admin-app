"use client";

import { useActionState } from "react";
import { createVendor, updateVendor, archiveVendor, restoreVendor, type VendorActionState } from "@/features/procurement/vendor-actions";
import { vendorAreaLabels, type VendorRow } from "@/features/procurement/vendor-rules";

const initial: VendorActionState = { kind: "idle", message: "" };

function VendorFields({ vendor }: { vendor?: VendorRow }) {
  const prefix = vendor ? `vendor-${vendor.id}` : "new-vendor";
  return <>
    <div className="field"><label htmlFor={`${prefix}-name`}>Nombre del proveedor</label><input id={`${prefix}-name`} name="name" required maxLength={200} defaultValue={vendor?.name} /></div>
    <div className="field"><label htmlFor={`${prefix}-area`}>Área asociada</label><select id={`${prefix}-area`} name="associatedArea" required defaultValue={vendor?.associated_area ?? ""}>
      <option value="" disabled>Selecciona un área</option>
      {Object.entries(vendorAreaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></div>
    <div className="field"><label htmlFor={`${prefix}-contact`}>Contacto</label><input id={`${prefix}-contact`} name="contactName" maxLength={200} defaultValue={vendor?.contact_name ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-email`}>Correo</label><input id={`${prefix}-email`} name="email" type="email" maxLength={254} defaultValue={vendor?.email ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-phone`}>Teléfono</label><input id={`${prefix}-phone`} name="phone" type="tel" maxLength={60} defaultValue={vendor?.phone ?? ""} /></div>
    <div className="field description-field"><label htmlFor={`${prefix}-notes`}>Observaciones</label><textarea id={`${prefix}-notes`} name="notes" maxLength={2000} rows={3} defaultValue={vendor?.notes ?? ""} /></div>
  </>;
}

export function CreateVendorForm() {
  const [state, action, pending] = useActionState(createVendor, initial);
  return <section className="work-card"><h2>Nuevo proveedor</h2>
    <form action={action} className="work-form vendor-form"><VendorFields />
      <button type="submit" className="primary-button" disabled={pending}>{pending ? "Guardando…" : "Guardar proveedor"}</button>
    </form>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </section>;
}

export function EditVendorForm({ vendor }: { vendor: VendorRow }) {
  const [state, action, pending] = useActionState(updateVendor, initial);
  return <form action={action} className="work-form edit-form vendor-edit-form"><input type="hidden" name="id" value={vendor.id} />
    <VendorFields vendor={vendor} />
    <button type="submit" className="primary-button" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}

export function VendorArchiveForm({ vendor, restoring = false }: { vendor: VendorRow; restoring?: boolean }) {
  const [state, action, pending] = useActionState(restoring ? restoreVendor : archiveVendor, initial);
  return <form action={action} className="vendor-archive-form"><input type="hidden" name="id" value={vendor.id} />
    <button type="submit" className={restoring ? "quiet-button" : "danger-button"} disabled={pending}>
      {pending ? "Guardando…" : restoring ? "Restaurar proveedor" : "Confirmar eliminación"}
    </button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}
