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

  it("shows a safe fallback for an unknown event", () => {
    expect(describeWorkItemEvent({ action: "created", before_values: null, after_values: {} })).toBe("Actividad creada");
    expect(describeWorkItemEvent({ action: "note", before_values: null, after_values: {} })).toBe("Nota sin contenido");
  });
});
