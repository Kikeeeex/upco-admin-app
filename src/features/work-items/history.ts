export type WorkItemHistoryEvent = {
  action: string;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown>;
};

const statuses: Record<string, string> = {
  pending: "Pendiente", in_progress: "En progreso", waiting: "En espera",
  completed: "Completada", cancelled: "Cancelada",
};
const priorities: Record<string, string> = {
  low: "Baja", medium: "Media", high: "Alta", critical: "Crítica",
};

export function describeWorkItemEvent(event: WorkItemHistoryEvent): string {
  const after = event.after_values;
  const before = event.before_values ?? {};
  if (event.action === "note") {
    return typeof after.body === "string" && after.body.trim() ? after.body : "Nota sin contenido";
  }
  if (event.action === "created") return "Actividad creada";
  if (event.action !== "updated") return "Evento de actividad";

  if (before.archived_at == null && typeof after.archived_at === "string") return "Actividad archivada";
  if (typeof before.archived_at === "string" && after.archived_at == null) return "Actividad restaurada";

  const changes: string[] = [];
  if (before.status !== after.status && typeof after.status === "string") {
    changes.push(`Estado: ${statuses[after.status] ?? after.status}`);
  }
  if (before.priority !== after.priority && typeof after.priority === "string") {
    changes.push(`Prioridad: ${priorities[after.priority] ?? after.priority}`);
  }
  if (before.due_date !== after.due_date) {
    changes.push(`Fecha límite: ${typeof after.due_date === "string" ? after.due_date : "sin fecha"}`);
  }
  return changes.join(" · ") || "Actividad actualizada";
}
