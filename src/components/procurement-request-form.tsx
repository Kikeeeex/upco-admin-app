"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { createProcurementRequest, updateProcurementRequester, type ProcurementRequestState } from "@/features/procurement/request-actions";
import type { SiteOption } from "@/components/work-item-forms";
import type { ProcurementDetail } from "@/features/procurement/request-rules";
import { vendorAreaLabels } from "@/features/procurement/vendor-rules";

const initial: ProcurementRequestState = { kind: "idle", message: "" };
export type VendorOption = { id: string; name: string };

function RequesterFields({ prefix, detail }: { prefix: string; detail?: ProcurementDetail }) {
  return <>
    <div className="field"><label htmlFor={`${prefix}-first`}>Nombre del solicitante</label><input id={`${prefix}-first`} name="requesterFirstName" required maxLength={100} defaultValue={detail?.requester_first_name ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-last`}>Apellido del solicitante</label><input id={`${prefix}-last`} name="requesterLastName" required maxLength={100} defaultValue={detail?.requester_last_name ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-area`}>Área solicitante</label><select id={`${prefix}-area`} name="requesterArea" required defaultValue={detail?.requester_area ?? ""}>
      <option value="" disabled>Selecciona un área</option>
      {Object.entries(vendorAreaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></div>
  </>;
}

export function CreateProcurementRequestForm({ sites, vendors }: { sites: SiteOption[]; vendors: VendorOption[] }) {
  const [state, action, pending] = useActionState(createProcurementRequest, initial);
  const [rows, setRows] = useState([0]);
  const nextRow = useRef(1);
  return <section className="work-card"><h2>Nueva solicitud</h2><form action={action} className="work-form">
    <div className="request-lines" aria-label="Artículos solicitados">
      {rows.map((rowId, index) => <fieldset className="request-line" key={rowId}><legend>Artículo {index + 1}</legend>
        <div className="request-line-grid">
          <div className="field"><label htmlFor={`new-prc-article-${rowId}`}>Artículo o servicio</label><input id={`new-prc-article-${rowId}`} name="article" required maxLength={200} placeholder="¿Qué necesitas adquirir?" /></div>
          <div className="field"><label htmlFor={`new-prc-part-${rowId}`}>Número de parte (opcional)</label><input id={`new-prc-part-${rowId}`} name="partNumber" maxLength={120} /></div>
          <div className="field"><label htmlFor={`new-prc-quantity-${rowId}`}>Cantidad</label><input id={`new-prc-quantity-${rowId}`} name="quantity" type="number" min="0.001" max="99999999999.999" step="0.001" required /></div>
          <div className="field"><label htmlFor={`new-prc-unit-${rowId}`}>Unidad</label><input id={`new-prc-unit-${rowId}`} name="unit" required maxLength={40} placeholder="Ej. unidades, cajas, horas" /></div>
        </div>
        {rows.length > 1 && <button className="quiet-button request-remove" type="button" aria-label={`Quitar artículo ${index + 1}`} onClick={() => setRows((current) => current.filter((id) => id !== rowId))}>Quitar artículo</button>}
      </fieldset>)}
      <button className="quiet-button request-add" type="button" disabled={rows.length >= 50} onClick={() => setRows((current) => [...current, nextRow.current++])}>Agregar artículo</button>
    </div>
    <div className="field"><label htmlFor="new-prc-site">Sede de destino</label><select id="new-prc-site" name="siteId" required defaultValue=""><option value="" disabled>Selecciona una sede</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.code} · {site.name}</option>)}</select></div>
    <div className="field"><label htmlFor="new-prc-vendor">Proveedor (opcional)</label><select id="new-prc-vendor" name="vendorId" defaultValue=""><option value="">Por definir</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select><small>Si aún no existe, créalo en «Nuevo proveedor» y vuelve a la solicitud.</small></div>
    <div className="field"><label htmlFor="new-prc-reference">Referencia (opcional)</label><input id="new-prc-reference" name="reference" maxLength={200} /></div>
    <RequesterFields prefix="new-prc" />
    <div className="field description-field"><label htmlFor="new-prc-need">Necesidad</label><textarea id="new-prc-need" name="need" rows={3} maxLength={5000} required placeholder="Explica para qué se necesita" /></div>
    <button className="primary-button" disabled={pending || sites.length === 0} type="submit">{pending ? "Guardando…" : "Guardar solicitud"}</button>
  </form>{sites.length === 0 && <p className="error-message">No hay sedes disponibles. Configura una sede antes de crear solicitudes.</p>}
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message} {state.href && <Link href={state.href}>Ver ficha</Link>}</p>}
  </section>;
}

export function EditProcurementRequesterForm({ detail }: { detail: ProcurementDetail }) {
  const [state, action, pending] = useActionState(updateProcurementRequester, initial);
  return <form action={action} className="work-form edit-form"><input type="hidden" name="id" value={detail.work_item_id} />
    <div className="field"><label htmlFor={`edit-prc-part-${detail.work_item_id}`}>Número de parte del primer artículo (opcional)</label><input id={`edit-prc-part-${detail.work_item_id}`} name="partNumber" maxLength={120} defaultValue={detail.part_number ?? ""} /></div>
    <RequesterFields prefix={`edit-prc-${detail.work_item_id}`} detail={detail} />
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar solicitante"}</button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}
