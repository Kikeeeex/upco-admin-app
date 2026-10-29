import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseAdminMatterInput, parseAdminDetailsUpdate } from "../../src/features/administration/rules";

const valid = { title: "Preparar informe", procedureType: "Informe", counterpartName: "Cliente A", documentStatus: "pending" };

describe("administrative matter validation", () => {
  it("allows a matter without a document and trims its fields", () => {
    expect(parseAdminMatterInput({ ...valid, title: "  Preparar informe  ", documentUrl: "" })).toMatchObject({
      title: "Preparar informe", documentStatus: "pending", documentUrl: undefined,
    });
  });

  it("rejects missing procedure type or counterpart", () => {
    expect(() => parseAdminMatterInput({ ...valid, procedureType: "  " })).toThrow();
    expect(() => parseAdminMatterInput({ ...valid, counterpartName: "" })).toThrow();
  });

  it("accepts only valid HTTP or HTTPS document links", () => {
    expect(() => parseAdminMatterInput({ ...valid, documentUrl: "javascript:alert(1)" })).toThrow();
    expect(() => parseAdminMatterInput({ ...valid, documentUrl: "https://" })).toThrow(ZodError);
    expect(parseAdminMatterInput({ ...valid, documentUrl: "https://example.com/documento" }).documentUrl).toBe("https://example.com/documento");
  });

  it("rejects invalid commitment dates and document states", () => {
    expect(() => parseAdminMatterInput({ ...valid, commitmentDate: "2026-02-30" })).toThrow();
    expect(() => parseAdminDetailsUpdate({ ...valid, id: "11111111-1111-4111-8111-111111111111", documentStatus: "approved" })).toThrow();
  });
});
