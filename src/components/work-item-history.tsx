import { describeWorkItemEvent, type WorkItemHistoryEvent } from "@/features/work-items/history";
import { AddWorkItemNoteForm } from "./work-item-forms";

export type ListedHistoryEvent = WorkItemHistoryEvent & {
  id: string;
  work_item_id: string;
  actor_id: string;
  occurred_at: string;
};

const dateTime = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas",
});

export function WorkItemHistory({ id, events, error, actorId, archived }: {
  id: string;
  events: ListedHistoryEvent[];
  error: boolean;
  actorId: string;
  archived: boolean;
}) {
  return <details className="history-panel"><summary>Notas e historial reciente</summary>
    {!archived && <AddWorkItemNoteForm id={id} />}
    {error ? <p className="error-message">No se pudo cargar el historial.</p> : events.length === 0 ?
      <p className="work-empty">Aún no hay eventos.</p> :
      <ol className="history-list">{events.map((event) => <li key={event.id}>
        <small>{dateTime.format(new Date(event.occurred_at))} · {event.actor_id === actorId ? "Tú" : "Miembro"}</small>
        <p>{describeWorkItemEvent(event)}</p>
      </li>)}</ol>}
  </details>;
}
