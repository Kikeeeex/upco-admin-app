"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createProcurementRequest, type ProcurementRequestState } from "@/features/procurement/request-actions";
import type { SiteOption } from "@/components/work-item-forms";

const initial: ProcurementRequestState = { kind: "idle", message: "" };
export type VendorOption = { id: string; name: string };

export function CreateProcurementRequestForm({ sites, vendors }: { sites: SiteOption[]; vendors: VendorOption[] }) {
  const [state, action, pending] = useActionState(createProcurementRequest, initial);
  return <section className="work-card"><h2>Nueva solicitud</h2><form action={action} className="work-form">
    <div className="field"><label htmlFor="new-prc-title">Artículo o servicio</label><input id="new-prc-title" name="title" required maxLength={200} placeholder="¿Qué necesitas adquirir?" /></div>
    <div className="field"><label htmlFor="new-prc-quantity">Cantidad</label><input id="new-prc-quantity" name="quantity" type="number" min="0.001" max="99999999999.999" step="0.001" required /></div>
    <div className="field"><label htmlFor="new-prc-unit">Unidad</label><input id="new-prc-unit" name="unit" required maxLength={40} placeholder="Ej. unidades, cajas, horas" /></div>
    <div className="field"><label htmlFor="new-prc-site">Sede de destino</label><select id="new-prc-site" name="siteId" required defaultValue=""><option value="" disabled>Selecciona una sede</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.code} · {site.name}</option>)}</select></div>
    <div className="field"><label htmlFor="new-prc-vendor">Proveedor (opcional)</label><select id="new-prc-vendor" name="vendorId" defaultValue=""><option value="">Por definir</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select><small>Si aún no existe, créalo en «Nuevo proveedor» y vuelve a la solicitud.</small></div>
    <div className="field"><label htmlFor="new-prc-reference">Referencia (opcional)</label><input id="new-prc-reference" name="reference" maxLength={200} /></div>
    <div className="field description-field"><label htmlFor="new-prc-need">Necesidad</label><textarea id="new-prc-need" name="need" rows={3} maxLength={5000} required placeholder="Explica para qué se necesita" /></div>
    <button className="primary-button" disabled={pending || sites.length === 0} type="submit">{pending ? "Guardando…" : "Guardar solicitud"}</button>
  </form>{sites.length === 0 && <p className="error-message">No hay sedes disponibles. Configura una sede antes de crear solicitudes.</p>}
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message} {state.href && <Link href={state.href}>Ver ficha</Link>}</p>}
  </section>;
}
