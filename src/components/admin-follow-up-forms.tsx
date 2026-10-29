"use client";

import { useActionState } from "react";
import { createAdminFollowUp, completeAdminFollowUp, rescheduleAdminFollowUp, type FollowUpActionState } from "@/features/administration/follow-up-actions";
import type { AdminFollowUp } from "@/features/administration/follow-ups";

const initial: FollowUpActionState = { kind: "idle", message: "" };

function CreateFollowUpForm({ workItemId }: { workItemId: string }) {
  const [state, action, pending] = useActionState(createAdminFollowUp, initial);
  return <form action={action} className="work-form follow-up-form"><input type="hidden" name="workItemId" value={workItemId} />
    <div className="field"><label htmlFor="new-follow-up-date">Fecha de seguimiento</label><input id="new-follow-up-date" name="scheduledFor" type="date" required /></div>
    <div className="field"><label htmlFor="new-follow-up-contact">Contacto</label><input id="new-follow-up-contact" name="contactName" maxLength={200} required /></div>
    <div className="field"><label htmlFor="new-follow-up-reason">Motivo</label><input id="new-follow-up-reason" name="reason" maxLength={500} required /></div>
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Guardando…" : "Programar seguimiento"}</button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}

function CompleteFollowUpForm({ item }: { item: AdminFollowUp }) {
  const [state, action, pending] = useActionState(completeAdminFollowUp, initial);
  return <form action={action} className="follow-up-inline-form"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="workItemId" value={item.work_item_id} />
    <div className="field"><label htmlFor={`result-${item.id}`}>Resultado</label><textarea id={`result-${item.id}`} name="outcome" maxLength={2000} required rows={2} /></div>
    <button type="submit" disabled={pending} className="quiet-button">Registrar resultado</button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}

function RescheduleFollowUpForm({ item }: { item: AdminFollowUp }) {
  const [state, action, pending] = useActionState(rescheduleAdminFollowUp, initial);
  return <form action={action} className="follow-up-inline-form"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="workItemId" value={item.work_item_id} />
    <div className="field"><label htmlFor={`reschedule-${item.id}`}>Nueva fecha</label><input id={`reschedule-${item.id}`} name="scheduledFor" type="date" required defaultValue={item.scheduled_for} /></div>
    <button type="submit" disabled={pending} className="quiet-button">Reprogramar</button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}

export function AdminFollowUpSection({ workItemId, items, canEdit }: { workItemId: string; items: AdminFollowUp[]; canEdit: boolean }) {
  return <section className="work-card follow-up-section"><h2>Seguimientos de la gestión</h2>
    {items.length === 0 ? <p className="work-empty">Aún no hay seguimientos.</p> : <ul className="follow-up-list">{items.map((item) => <li key={item.id}>
      <span className="badge">{item.status === "done" ? "Realizado" : "Pendiente"} · {item.scheduled_for}</span>
      <strong>{item.reason}</strong><span>Contacto: {item.contact_name}</span>
      {item.outcome && <p>Resultado: {item.outcome}</p>}
      {canEdit && item.status === "pending" && <div className="follow-up-controls"><CompleteFollowUpForm item={item} /><RescheduleFollowUpForm item={item} /></div>}
    </li>)}</ul>}
    {canEdit && <><h3>Nuevo seguimiento</h3><CreateFollowUpForm workItemId={workItemId} /></>}
  </section>;
}
