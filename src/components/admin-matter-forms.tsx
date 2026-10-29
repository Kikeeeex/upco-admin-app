"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createAdminMatter, updateAdminDetails, type AdminActionState } from "@/features/administration/actions";
import type { SiteOption } from "@/components/work-item-forms";

const initial: AdminActionState = { kind: "idle", message: "" };

export type AdminDetail = {
  work_item_id: string;
  procedure_type: string;
  counterpart_name: string;
  reference: string | null;
  document_status: string;
  document_reference: string | null;
  document_url: string | null;
};

const documentStatuses = [["pending", "Pendiente"], ["received", "Recibida"], ["reviewed", "Revisada"]] as const;

function DocumentFields({ details }: { details?: AdminDetail }) {
  const prefix = details ? `edit-${details.work_item_id}` : "new-admin";
  return <>
    <div className="field"><label htmlFor={`${prefix}-type`}>Tipo de gestión</label><input id={`${prefix}-type`} name="procedureType" required maxLength={120} defaultValue={details?.procedure_type} placeholder="Ej. Informe" /></div>
    <div className="field"><label htmlFor={`${prefix}-counterpart`}>Contraparte</label><input id={`${prefix}-counterpart`} name="counterpartName" required maxLength={200} defaultValue={details?.counterpart_name} placeholder="Persona u organización" /></div>
    <div className="field"><label htmlFor={`${prefix}-reference`}>Referencia de gestión</label><input id={`${prefix}-reference`} name="reference" maxLength={200} defaultValue={details?.reference ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-document-status`}>Estado documental</label><select id={`${prefix}-document-status`} name="documentStatus" defaultValue={details?.document_status ?? "pending"}>{documentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="field"><label htmlFor={`${prefix}-document-reference`}>Referencia del documento</label><input id={`${prefix}-document-reference`} name="documentReference" maxLength={200} defaultValue={details?.document_reference ?? ""} /></div>
    <div className="field"><label htmlFor={`${prefix}-document-url`}>Enlace del documento</label><input id={`${prefix}-document-url`} name="documentUrl" type="url" maxLength={2000} defaultValue={details?.document_url ?? ""} placeholder="https://" /></div>
  </>;
}

export function CreateAdminMatterForm({ sites }: { sites: SiteOption[] }) {
  const [state, action, pending] = useActionState(createAdminMatter, initial);
  return <section className="work-card"><h2>Nueva gestión</h2><form action={action} className="work-form admin-form">
    <div className="field"><label htmlFor="new-admin-title">Asunto</label><input id="new-admin-title" name="title" required maxLength={200} placeholder="¿Qué gestión necesitas registrar?" /></div>
    <DocumentFields />
    <div className="field"><label htmlFor="new-admin-date">Fecha de compromiso</label><input id="new-admin-date" name="commitmentDate" type="date" /></div>
    <div className="field"><label htmlFor="new-admin-site">Sede</label><select id="new-admin-site" name="siteId"><option value="">Sin sede</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.code} · {site.name}</option>)}</select></div>
    <div className="field description-field"><label htmlFor="new-admin-description">Descripción (opcional)</label><textarea id="new-admin-description" name="description" rows={3} maxLength={5000} /></div>
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar gestión"}</button>
  </form>{state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message} {state.href && <Link href={state.href}>Ver ficha</Link>}</p>}</section>;
}

export function EditAdminDetailsForm({ details }: { details: AdminDetail }) {
  const [state, action, pending] = useActionState(updateAdminDetails, initial);
  return <form action={action} className="work-form edit-form admin-edit-form"><input type="hidden" name="id" value={details.work_item_id} />
    <DocumentFields details={details} />
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar documentación"}</button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}
