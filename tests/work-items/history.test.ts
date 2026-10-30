import { describe, expect, it } from "vitest";
import { describeWorkItemEvent } from "../../src/features/work-items/history";

describe("describeWorkItemEvent", () => {
  it("shows the note body without replacing previous notes", () => {
    expect(describeWorkItemEvent({ action: "note", before_values: null, after_values: { body: "Llamar al proveedor" } }))
      .toBe("Llamar al proveedor");
  });

  it("distinguishes archiving from restoring", () => {
    expect(describeWorkItemEvent({ action: "updated", before_values: { archived_at: null }, after_values: { archived_at: "2026-10-28T18:00:00Z" } }))
      .toBe("Actividad archivada");
    expect(describeWorkItemEvent({ action: "updated", before_values: { archived_at: "2026-10-28T18:00:00Z" }, after_values: { archived_at: null } }))
      .toBe("Actividad restaurada");
  });

  it("describes status and priority changes", () => {
    expect(describeWorkItemEvent({ action: "updated", before_values: { status: "pending", priority: "medium" }, after_values: { status: "in_progress", priority: "high" } }))
      .toBe("Estado: En progreso · Prioridad: Alta");
  });

  it("describes administrative document changes in the activity history", () => {
    expect(describeWorkItemEvent({
      action: "updated",
      before_values: { document_status: "pending", document_reference: null, document_url: null },
      after_values: { document_status: "received", document_reference: "DOC-1", document_url: "https://example.com/doc" },
    })).toBe("Documentación: Recibida · Referencia documental: DOC-1 · Enlace documental actualizado");
  });

  it("describes part number and requester changes in the PRC history", () => {
    expect(describeWorkItemEvent({ action: "updated",
      before_values: { part_number: "PART-123", requester_first_name: "Ana", requester_last_name: "Pérez", requester_area: "operations" },
      after_values: { part_number: null, requester_first_name: "Ana", requester_last_name: "García", requester_area: "finance" },
    })).toBe("Número de parte: sin número · Solicitante: Ana García · Área solicitante: Finanzas");
  });

  it("describes a scheduled, rescheduled and completed follow-up", () => {
    expect(describeWorkItemEvent({ action: "updated", before_values: null,
      after_values: { follow_up_id: "x", follow_up_status: "pending", follow_up_date: "2026-11-02" } }))
      .toBe("Seguimiento programado: 2026-11-02");
    expect(describeWorkItemEvent({ action: "updated", before_values: { follow_up_id: "x", follow_up_status: "pending", follow_up_date: "2026-11-02" },
      after_values: { follow_up_id: "x", follow_up_status: "pending", follow_up_date: "2026-11-03" } }))
      .toBe("Seguimiento reprogramado: 2026-11-03");
    expect(describeWorkItemEvent({ action: "updated", before_values: { follow_up_id: "x", follow_up_status: "pending", follow_up_date: "2026-11-03" },
      after_values: { follow_up_id: "x", follow_up_status: "done", follow_up_date: "2026-11-03", follow_up_outcome: "Entrega recibida" } }))
      .toBe("Seguimiento realizado: Entrega recibida");
  });

  it("shows a safe fallback for an unknown event", () => {
    expect(describeWorkItemEvent({ action: "created", before_values: null, after_values: {} })).toBe("Actividad creada");
    expect(describeWorkItemEvent({ action: "note", before_values: null, after_values: {} })).toBe("Nota sin contenido");
  });
});
