"use client";

import { useActionState } from "react";
import { createVendor, updateVendor, archiveVendor, restoreVendor, deleteVendorPermanently, type VendorActionState } from "@/features/procurement/vendor-actions";
import type { VendorRow } from "@/features/procurement/vendor-rules";

const initial: VendorActionState = { kind: "idle", message: "" };

function VendorFields({ vendor }: { vendor?: VendorRow }) {
  const prefix = vendor ? `vendor-${vendor.id}` : "new-vendor";
  return <>
    <div className="field"><label htmlFor={`${prefix}-name`}>Proveedor</label><input id={`${prefix}-name`} name="name" required maxLength={200} defaultValue={vendor?.name} /></div>
    <div className="field"><label htmlFor={`${prefix}-country`}>País</label><input id={`${prefix}-country`} name="country" maxLength={100} defaultValue={vendor?.country ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-tax`}>RIF / identificación fiscal</label><input id={`${prefix}-tax`} name="taxIdentifier" maxLength={100} defaultValue={vendor?.tax_identifier ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-phone`}>Teléfono</label><input id={`${prefix}-phone`} name="phone" type="tel" maxLength={60} defaultValue={vendor?.phone ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-email`}>Correo electrónico</label><input id={`${prefix}-email`} name="email" type="email" maxLength={254} defaultValue={vendor?.email ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-sales`}>Área de venta</label><input id={`${prefix}-sales`} name="salesArea" maxLength={200} defaultValue={vendor?.sales_area ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-contact`}>Persona de contacto</label><input id={`${prefix}-contact`} name="contactPerson" maxLength={200} defaultValue={vendor?.contact_name ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-website`}>Sitio web</label><input id={`${prefix}-website`} name="website" maxLength={500} defaultValue={vendor?.website ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-city`}>Ciudad</label><input id={`${prefix}-city`} name="city" maxLength={150} defaultValue={vendor?.city ?? ""} /></div>
    <div className="field description-field"><label htmlFor={`${prefix}-detail`}>Detalle de productos y servicios</label><textarea id={`${prefix}-detail`} name="productsServicesDetail" rows={4} defaultValue={vendor?.products_services_detail ?? ""} /></div>
  </>;
}

export function CreateVendorForm() {
  const [state, action, pending] = useActionState(createVendor, initial);
  return <section id="nuevo-proveedor" className="work-card"><h2>Nuevo proveedor</h2>
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

export function VendorPermanentDeleteForm({ vendor }: { vendor: VendorRow }) {
  const [state, action, pending] = useActionState(deleteVendorPermanently, initial);
  return <details className="vendor-delete"><summary>Eliminar permanentemente</summary>
    <p>Esta acción no se puede deshacer. Se perderán todos los datos de este proveedor.</p>
    <form action={action} className="vendor-archive-form"><input type="hidden" name="id" value={vendor.id} />
      <button type="submit" className="danger-button" disabled={pending}>
        {pending ? "Eliminando…" : "Confirmar eliminación permanente"}
      </button>
      {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
    </form>
  </details>;
}
