"use client";

import { useActionState } from "react";
import { addWorkItemNote, archiveWorkItem, createWorkItem, restoreWorkItem, updateWorkItem, type ActionState } from "@/features/work-items/actions";

const initial: ActionState = { kind: "idle", message: "" };
const priorities = [["low", "Baja"], ["medium", "Media"], ["high", "Alta"], ["critical", "Crítica"]] as const;
const statuses = [["pending", "Pendiente"], ["in_progress", "En progreso"], ["waiting", "En espera"], ["completed", "Completada"], ["cancelled", "Cancelada"]] as const;

export type ListedWorkItem = {
  id: string; code: string; type: string; title: string; status: string; priority: string; creator_id: string;
  description: string | null; site_id: string | null;
  due_date: string | null; closed_at: string | null; archived_at: string | null;
};

export type SiteOption = { id: string; code: string; name: string };

function SiteField({ id, sites, value }: { id: string; sites: SiteOption[]; value?: string | null }) {
  return <div className="field"><label htmlFor={id}>Sede</label>
    <select id={id} name="siteId" defaultValue={value ?? ""}>
      <option value="">Sin sede</option>
      {sites.map((site) => <option key={site.id} value={site.id}>{site.code} · {site.name}</option>)}
      {value && !sites.some((site) => site.id === value) && <option value={value}>Sede no disponible</option>}
    </select>
    {sites.length === 0 && <small>No hay sedes configuradas. Puedes guardar sin sede.</small>}
  </div>;
}

export function CreateWorkItemForm({ sites }: { sites: SiteOption[] }) {
  const [state, action, pending] = useActionState(createWorkItem, initial);
  return <section className="work-card"><h2>Nueva actividad</h2><form action={action} className="work-form">
    <div className="field"><label htmlFor="new-title">Título</label><input id="new-title" name="title" required maxLength={200} placeholder="¿Qué necesitas hacer?" /></div>
    <div className="field"><label htmlFor="new-area">Área</label><select id="new-area" name="area" defaultValue="general"><option value="general">General</option><option value="administration">Administración</option><option value="procurement">Procura</option><option value="it">TI</option></select></div>
    <div className="field"><label htmlFor="new-priority">Prioridad</label><select id="new-priority" name="priority" defaultValue="medium">{priorities.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
    <div className="field"><label htmlFor="new-due">Fecha límite</label><input id="new-due" name="dueDate" type="date" /></div>
    <div className="field description-field"><label htmlFor="new-description">Descripción (opcional)</label><textarea id="new-description" name="description" maxLength={5000} rows={3} placeholder="Añade contexto para esta actividad" /></div>
    <SiteField id="new-site" sites={sites} />
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar actividad"}</button>
  </form>{state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}</section>;
}

export function EditWorkItemForm({ item, sites }: { item: ListedWorkItem; sites: SiteOption[] }) {
  const [state, action, pending] = useActionState(updateWorkItem, initial);
  return <form action={action} className="work-form edit-form"><input type="hidden" name="id" value={item.id} />
    <div className="field"><label htmlFor={`title-${item.id}`}>Título</label><input id={`title-${item.id}`} name="title" defaultValue={item.title} required maxLength={200} /></div>
    <div className="field description-field"><label htmlFor={`description-${item.id}`}>Descripción (opcional)</label><textarea id={`description-${item.id}`} name="description" defaultValue={item.description ?? ""} maxLength={5000} rows={3} /></div>
    <SiteField id={`site-${item.id}`} sites={sites} value={item.site_id} />
    <div className="field"><label htmlFor={`priority-${item.id}`}>Prioridad</label><select id={`priority-${item.id}`} name="priority" defaultValue={item.priority}>{priorities.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
    <div className="field"><label htmlFor={`status-${item.id}`}>Estado</label><select id={`status-${item.id}`} name="status" defaultValue={item.status}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
    <div className="field"><label htmlFor={`due-${item.id}`}>Fecha límite</label><input id={`due-${item.id}`} name="dueDate" type="date" defaultValue={item.due_date ?? ""} /></div>
    <button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}

export function ArchiveWorkItemForm({ id, archived }: { id: string; archived: boolean }) {
  const [state, action, pending] = useActionState(archived ? restoreWorkItem : archiveWorkItem, initial);
  return <form action={action} className="inline-action"><input type="hidden" name="id" value={id} />
    <button className="quiet-button" type="submit" disabled={pending}>{pending ? "Guardando…" : archived ? "Restaurar" : "Archivar"}</button>
    {state.kind === "error" && <p role="status" className="error-message">{state.message}</p>}
  </form>;
}

export function AddWorkItemNoteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(addWorkItemNote, initial);
  return <form action={action} className="note-form"><input type="hidden" name="id" value={id} />
    <label htmlFor={`note-${id}`}>Nueva nota</label>
    <textarea id={`note-${id}`} name="body" required maxLength={2000} rows={3} placeholder="Escribe una actualización breve" />
    <button className="quiet-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Añadir nota"}</button>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </form>;
}
