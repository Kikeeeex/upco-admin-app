import { describe, expect, it } from "vitest";
import { isOverdue, parseWorkItemId, parseWorkItemInput, parseWorkItemNote, parseWorkItemUpdate } from "../../src/features/work-items/rules";

const valid = {
  title: "  Preparar informe  ",
  area: "administration",
  priority: "high",
  dueDate: "2026-10-27",
};

describe("parseWorkItemInput", () => {
  it("trims the title and accepts valid values", () => {
    expect(parseWorkItemInput(valid)).toEqual({
      title: "Preparar informe",
      area: "administration",
      priority: "high",
      dueDate: "2026-10-27",
    });
  });

  it("rejects a blank title", () => {
    expect(() => parseWorkItemInput({ ...valid, title: "   " })).toThrow();
  });

  it("rejects an unsupported priority", () => {
    expect(() => parseWorkItemInput({ ...valid, priority: "urgent" })).toThrow();
  });

  it("rejects an invalid calendar date", () => {
    expect(() => parseWorkItemInput({ ...valid, dueDate: "2026-02-30" })).toThrow();
  });

  it("trims an optional description and accepts an organization site UUID", () => {
    expect(parseWorkItemInput({ ...valid, description: "  Revisar contrato  ", siteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" })).toEqual({
      ...valid, title: "Preparar informe", description: "Revisar contrato", siteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
  });

  it("rejects an oversized description or malformed site", () => {
    expect(() => parseWorkItemInput({ ...valid, description: "x".repeat(5001) })).toThrow();
    expect(() => parseWorkItemInput({ ...valid, siteId: "other-org" })).toThrow();
  });

  it("normalizes a whitespace-only description to absence", () => {
    expect(parseWorkItemInput({ ...valid, description: "   " }).description).toBeUndefined();
  });
});

describe("parseWorkItemUpdate", () => {
  const update = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Caso revisado", priority: "critical", status: "waiting", dueDate: "2026-11-02" };

  it("accepts a valid update", () => {
    expect(parseWorkItemUpdate(update)).toEqual(update);
  });

  it("rejects an invalid state transition value", () => {
    expect(() => parseWorkItemUpdate({ ...update, status: "archived" })).toThrow();
  });

  it("accepts optional description and site when updating", () => {
    expect(parseWorkItemUpdate({ ...update, description: "  Respuesta recibida ", siteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" })).toEqual({
      ...update, description: "Respuesta recibida", siteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
  });
});

describe("parseWorkItemId", () => {
  it("accepts a work item UUID and rejects a malformed archive target", () => {
    expect(parseWorkItemId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(() => parseWorkItemId("not-an-id")).toThrow();
  });
});

describe("parseWorkItemNote", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("trims a note for a valid work item", () => {
    expect(parseWorkItemNote({ id, body: "  Revisar documento  " })).toEqual({ id, body: "Revisar documento" });
  });

  it("rejects blank, oversized and invalid work item notes", () => {
    expect(() => parseWorkItemNote({ id, body: "   " })).toThrow();
    expect(() => parseWorkItemNote({ id, body: "x".repeat(2001) })).toThrow();
    expect(() => parseWorkItemNote({ id: "wrong", body: "Nota" })).toThrow();
  });
});

describe("isOverdue", () => {
  it("uses the local calendar day, excluding completed work", () => {
    expect(isOverdue("2026-10-27", "pending", "2026-10-28")).toBe(true);
    expect(isOverdue("2026-10-28", "pending", "2026-10-28")).toBe(false);
    expect(isOverdue("2026-10-27", "completed", "2026-10-28")).toBe(false);
  });
});
