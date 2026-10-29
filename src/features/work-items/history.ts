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
const documentStatuses: Record<string, string> = {
  pending: "Pendiente", received: "Recibida", reviewed: "Revisada",
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
  if (before.procedure_type !== after.procedure_type && typeof after.procedure_type === "string") {
    changes.push(`Tipo de gestión: ${after.procedure_type}`);
  }
  if (before.counterpart_name !== after.counterpart_name && typeof after.counterpart_name === "string") {
    changes.push(`Contraparte: ${after.counterpart_name}`);
  }
  if (before.reference !== after.reference && "reference" in after) {
    changes.push(`Referencia de gestión: ${typeof after.reference === "string" ? after.reference : "sin referencia"}`);
  }
  if (before.document_status !== after.document_status && typeof after.document_status === "string") {
    changes.push(`Documentación: ${documentStatuses[after.document_status] ?? after.document_status}`);
  }
  if (before.document_reference !== after.document_reference && "document_reference" in after) {
    changes.push(`Referencia documental: ${typeof after.document_reference === "string" ? after.document_reference : "sin referencia"}`);
  }
  if (before.document_url !== after.document_url && "document_url" in after) {
    changes.push(typeof after.document_url === "string" ? "Enlace documental actualizado" : "Enlace documental retirado");
  }
  return changes.join(" · ") || "Actividad actualizada";
}
