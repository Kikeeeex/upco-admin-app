import { describe, expect, it, vi } from "vitest";

const { accessContext, revalidatePath } = vi.hoisted(() => ({ accessContext: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));

import { parseProcurementRequestInput, parseProcurementRequesterUpdate } from "../../src/features/procurement/request-rules";
import { createProcurementRequest, updateProcurementRequester } from "../../src/features/procurement/request-actions";

const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const siteId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const vendorId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const itemId = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const valid = { title: "Guantes", quantity: "2.5", unit: "cajas", siteId, need: "Reponer inventario",
  requesterFirstName: "Ana", requesterLastName: "Pérez", requesterArea: "operations" };
const initial = { kind: "idle" as const, message: "" };

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("procurement request", () => {
  it("trims text and permits an optional catalog vendor", () => {
    expect(parseProcurementRequestInput({ ...valid, title: " Guantes ", vendorId, reference: " REF-1 " }))
      .toMatchObject({ title: "Guantes", quantity: "2.5", vendorId, reference: "REF-1" });
  });

  it("rejects zero, negative and overprecise quantities", () => {
    for (const quantity of ["", "0", "-1", "1.2345", "Infinity", "1e3", "100000000000"])
      expect(() => parseProcurementRequestInput({ ...valid, quantity })).toThrow();
  });

  it("requires a destination site, unit and need", () => {
    expect(() => parseProcurementRequestInput({ ...valid, siteId: "" })).toThrow();
    expect(() => parseProcurementRequestInput({ ...valid, unit: " " })).toThrow();
    expect(() => parseProcurementRequestInput({ ...valid, need: "" })).toThrow();
  });

  it("requires requester name, surname and one of the six areas; part number is optional", () => {
    expect(parseProcurementRequestInput({ ...valid, partNumber: "  ABC-123  " }).partNumber).toBe("ABC-123");
    expect(parseProcurementRequestInput({ ...valid, partNumber: "" }).partNumber).toBeUndefined();
    expect(() => parseProcurementRequestInput({ ...valid, requesterFirstName: " " })).toThrow();
    expect(() => parseProcurementRequestInput({ ...valid, requesterLastName: "" })).toThrow();
    expect(() => parseProcurementRequestInput({ ...valid, requesterArea: "general" })).toThrow();
    expect(() => parseProcurementRequesterUpdate({ id: itemId, requesterFirstName: "Ana", requesterLastName: "Pérez", requesterArea: "it", partNumber: "  " })).not.toThrow();
  });

  it("creates the complete request through the authorized atomic RPC", async () => {
    let args: Record<string, unknown> = {};
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: "user" }, supabase: {
      async rpc(name: string, value: Record<string, unknown>) { expect(name).toBe("create_procurement_request"); args = value; return { data: itemId, error: null }; },
    } });
    const result = await createProcurementRequest(initial, form({ ...valid, vendorId, reference: "REF-1", partNumber: "ABC-123" }));
    expect(result).toMatchObject({ kind: "success", href: `/procura/${itemId}` });
    expect(args).toMatchObject({ p_organization_id: orgId, p_title: "Guantes", p_quantity: "2.5",
      p_unit: "cajas", p_site_id: siteId, p_need: "Reponer inventario", p_reference: "REF-1", p_vendor_id: vendorId,
      p_part_number: "ABC-123", p_requester_first_name: "Ana", p_requester_last_name: "Pérez", p_requester_area: "operations" });
  });

  it("does not write invalid requests", async () => {
    const rpc = vi.fn();
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: "user" }, supabase: { rpc } });
    expect((await createProcurementRequest(initial, form({ ...valid, quantity: "0" }))).kind).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires an authorized session", async () => {
    accessContext.mockResolvedValue({ kind: "anonymous" });
    expect((await createProcurementRequest(initial, form(valid))).kind).toBe("error");
  });

  it("updates requester data only for an owned active PRC", async () => {
    let changes: Record<string, unknown> = {};
    const check = { eq() { return this; }, is() { return this; }, async maybeSingle() { return { data: { id: itemId }, error: null }; } };
    const update = { update(value: Record<string, unknown>) { changes = value; return this; }, eq() { return this; }, select() { return this; }, async maybeSingle() { return { data: { work_item_id: itemId }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: "user" }, supabase: { from: (table: string) => table === "work_items" ? { select: () => check } : update } });
    const result = await updateProcurementRequester(initial, form({ id: itemId, requesterFirstName: "Ana", requesterLastName: "Pérez", requesterArea: "finance", partNumber: "" }));
    expect(result.kind).toBe("success");
    expect(changes).toMatchObject({ requester_first_name: "Ana", requester_last_name: "Pérez", requester_area: "finance", part_number: null });
  });
});
