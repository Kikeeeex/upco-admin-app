import { describe, expect, it, vi } from "vitest";
import { parseVendorInput, parseVendorUpdate } from "../../src/features/procurement/vendor-rules";

const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";
const vendorId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("vendor validation", () => {
  it("requires a name and normalizes spaces", () => {
    expect(parseVendorInput({ name: "  Acme   S.A.  ", associatedArea: "products_services", contactName: " Ana ", email: "" }))
      .toMatchObject({ name: "Acme S.A.", contactName: "Ana", email: undefined });
    expect(() => parseVendorInput({ name: "  ", associatedArea: "siaho" })).toThrow();
  });
  it("rejects invalid email and excessive notes", () => {
    expect(() => parseVendorInput({ name: "Acme", associatedArea: "it", email: "sin-arroba" })).toThrow();
    expect(() => parseVendorInput({ name: "Acme", associatedArea: "it", notes: "x".repeat(2001) })).toThrow();
    expect(parseVendorUpdate({ id: vendorId, name: "Acme", associatedArea: "finance", phone: "" }).phone).toBeUndefined();
  });
  it("requires an existing associated area", () => {
    for (const area of ["siaho", "products_services", "operations", "administration", "finance", "it"])
      expect(parseVendorInput({ name: "Acme", associatedArea: area }).associatedArea).toBe(area);
    for (const area of ["sales", "procurement", "general", ""])
      expect(() => parseVendorInput({ name: "Acme", associatedArea: area })).toThrow();
    expect(() => parseVendorInput({ name: "Acme" })).toThrow();
  });
});

const { accessContext, revalidatePath } = vi.hoisted(() => ({ accessContext: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
import { createVendor, updateVendor, archiveVendor, restoreVendor } from "../../src/features/procurement/vendor-actions";

const initial = { kind: "idle" as const, message: "" };
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }

describe("vendor actions", () => {
  it("creates a vendor in the signed-in organization", async () => {
    let inserted: Record<string, unknown> = {};
    const query = { insert(value: Record<string, unknown>) { inserted = value; return this; }, select() { return this; }, async maybeSingle() { return { data: { id: vendorId }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: () => query } });
    const result = await createVendor(initial, form({ name: " Acme  S.A. ", associatedArea: "it", contactName: "Ana", email: "ana@example.com", phone: "", notes: "" }));
    expect(result.kind).toBe("success");
    expect(inserted).toMatchObject({ organization_id: orgId, created_by: userId, name: "Acme S.A.", associated_area: "it", phone: null, notes: null });
    expect(revalidatePath).toHaveBeenCalledWith("/procura");
  });

  it("reports a duplicate name without creating another supplier", async () => {
    const query = { insert() { return this; }, select() { return this; }, async maybeSingle() { return { data: null, error: { code: "23505" } }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: () => query } });
    expect((await createVendor(initial, form({ name: "ACME S.A.", associatedArea: "operations" }))).message).toContain("Ya existe");
  });

  it("edits only the requested owned vendor and clears optional fields", async () => {
    let changes: Record<string, unknown> = {};
    const filters: Array<[string, unknown]> = [];
    const query = { update(value: Record<string, unknown>) { changes = value; return this; }, eq(field: string, value: unknown) { filters.push([field, value]); return this; }, is(field: string, value: unknown) { filters.push([field, value]); return this; }, select() { return this; }, async maybeSingle() { return { data: { id: vendorId }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: () => query } });
    const result = await updateVendor(initial, form({ id: vendorId, name: "Acme S.A.", associatedArea: "siaho", contactName: "", email: "", phone: "", notes: "" }));
    expect(result.kind).toBe("success");
    expect(changes).toEqual({ name: "Acme S.A.", associated_area: "siaho", contact_name: null, email: null, phone: null, notes: null });
    expect(filters).toContainEqual(["organization_id", orgId]);
    expect(filters).toContainEqual(["created_by", userId]);
    expect(filters).toContainEqual(["archived_at", null]);
  });

  it("archives and restores only the creator's vendor", async () => {
    const changes: Array<Record<string, unknown>> = [];
    const filters: Array<[string, unknown]> = [];
    const query = { update(value: Record<string, unknown>) { changes.push(value); return this; },
      eq(field: string, value: unknown) { filters.push([field, value]); return this; },
      is(field: string, value: unknown) { filters.push([field, value]); return this; },
      not(field: string, op: string, value: unknown) { filters.push([field, `${op}:${value}`]); return this; },
      select() { return this; }, async maybeSingle() { return { data: { id: vendorId }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: () => query } });
    expect((await archiveVendor(initial, form({ id: vendorId }))).kind).toBe("success");
    expect((await restoreVendor(initial, form({ id: vendorId }))).kind).toBe("success");
    expect(changes[0].archived_at).toEqual(expect.any(String));
    expect(changes[1]).toEqual({ archived_at: null });
    expect(filters).toContainEqual(["organization_id", orgId]);
    expect(filters).toContainEqual(["created_by", userId]);
    expect(filters).toContainEqual(["archived_at", null]);
    expect(filters).toContainEqual(["archived_at", "is:null"]);
  });

  it("rejects unauthenticated creation", async () => {
    accessContext.mockResolvedValue({ kind: "anonymous" });
    expect((await createVendor(initial, form({ name: "Acme", associatedArea: "products_services" }))).kind).toBe("error");
  });
});
