import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { analyzeVendorRows, buildVendorImportPlan } from "../../src/features/procurement/vendor-import-rules";
import type { MappedVendorRow } from "../../src/features/procurement/vendor-import-parser";

const row = (sourceRow: number, name: string, country?: string, taxIdentifier?: string): MappedVendorRow => ({
  sourceRow, data: { name, country, taxIdentifier }, errors: [], warnings: [],
});

describe("vendor import commit plan", () => {
  it("skips matches by default and only updates selected owned matches and fields", () => {
    const preview = analyzeVendorRows([row(2, "Nuevo", "Venezuela"), row(3, "Acme S.A.", "Venezuela", "J001")], existing);
    const plan = buildVendorImportPlan(preview, existing[0].created_by, [3], ["phone", "email"], existing);
    expect(plan.map((item) => item.mode)).toEqual(["create", "update"]);
    expect(plan.map((item) => item.sourceRow)).toEqual([2, 3]);
    expect(plan[1]).toMatchObject({ vendorId: existing[0].id, fields: ["phone", "email"] });
    expect(buildVendorImportPlan(preview, existing[0].created_by, [], ["phone"], existing)[1].mode).toBe("skip");
  });
  it("never updates archived or other owners' vendors", () => {
    const preview = analyzeVendorRows([row(2, "Acme S.A.", "Venezuela", "J001")], existing);
    expect(buildVendorImportPlan(preview, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", [2], ["phone"], existing)[0].mode).toBe("skip");
  });
});
const existing = [{ id: "11111111-1111-4111-8111-111111111111", name: "Acme S.A.", country: "Venezuela", tax_identifier: "J-001", archived_at: null, created_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }];

describe("vendor import preview", () => {
  it("matches tax ID within country and allows the same name in another country", () => {
    const result = analyzeVendorRows([row(2, "Otro nombre", " Venezuela ", "J001"), row(3, "Acme S.A.", "Colombia", "J001")], existing);
    expect(result.map((item) => item.status)).toEqual(["match", "new"]);
    expect(result[0].matchedVendorId).toBe(existing[0].id);
  });
  it("requires review for missing country, similar names and archived matches", () => {
    const archived = { ...existing[0], archived_at: "2026-11-01T10:00:00Z" };
    const result = analyzeVendorRows([row(2, "Acme S.A."), row(3, "Acme SA", "Venezuela"), row(4, "Acme S.A.", "Venezuela", "J-001")], [archived]);
    expect(result.map((item) => item.status)).toEqual(["review", "review", "review"]);
  });
  it("reviews a country-qualified name when an existing vendor lacks country", () => {
    const unknownCountry = { ...existing[0], country: null, tax_identifier: null };
    expect(analyzeVendorRows([row(2, "Acme S.A.", "Venezuela")], [unknownCountry])[0].status).toBe("review");
  });
  it("marks repeated rows in the same file and preserves validation errors", () => {
    const invalid: MappedVendorRow = { sourceRow: 4, data: null, errors: ["Correo electrónico no válido."], warnings: [] };
    const result = analyzeVendorRows([row(2, "Proveedor Uno", "Venezuela"), row(3, " PROVEEDOR  UNO ", "venezuela"), invalid], []);
    expect(result.map((item) => item.status)).toEqual(["new", "duplicate_file", "error"]);
    expect(result[2].errors).toEqual(["Correo electrónico no válido."]);
  });
});
