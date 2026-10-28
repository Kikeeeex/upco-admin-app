import { describeWorkItemEvent, type WorkItemHistoryEvent } from "@/features/work-items/history";
import { formatWorkItemDateTime } from "@/features/work-items/presentation";
import { AddWorkItemNoteForm } from "./work-item-forms";

export type ListedHistoryEvent = WorkItemHistoryEvent & {
  id: string;
  work_item_id: string;
  actor_id: string;
  occurred_at: string;
};

export function WorkItemHistory({ id, events, error, actorNames, timezone, canAddNote }: {
  id: string;
  events: ListedHistoryEvent[];
  error: boolean;
  actorNames: Record<string, string>;
  timezone: string;
  canAddNote: boolean;
}) {
  return <section className="history-panel"><h2>Notas e historial</h2>
    {canAddNote && <AddWorkItemNoteForm id={id} />}
    {error ? <p className="error-message">No se pudo cargar el historial.</p> : events.length === 0 ?
      <p className="work-empty">Aún no hay eventos.</p> :
      <ol className="history-list">{events.map((event) => <li key={event.id}>
        <small>{formatWorkItemDateTime(event.occurred_at, timezone)} · {actorNames[event.actor_id] ?? `Usuario ${event.actor_id}`}</small>
        <p>{describeWorkItemEvent(event)}</p>
      </li>)}</ol>}
  </section>;
}
