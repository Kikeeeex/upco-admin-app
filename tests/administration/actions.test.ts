import { describe, expect, it, vi } from "vitest";

const { accessContext, revalidatePath } = vi.hoisted(() => ({ accessContext: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));

import { createAdminMatter, updateAdminDetails } from "../../src/features/administration/actions";

const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";
const itemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const initial = { kind: "idle" as const, message: "" };

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("administrative matter actions", () => {
  it("creates an ADM matter atomically with the authorized organization", async () => {
    let args: Record<string, unknown> = {};
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: {
      async rpc(name: string, value: Record<string, unknown>) { expect(name).toBe("create_admin_matter"); args = value; return { data: itemId, error: null }; },
    } });
    const result = await createAdminMatter(initial, form({
      title: "Preparar informe", procedureType: "Informe", counterpartName: "Cliente A",
      documentStatus: "pending", commitmentDate: "2026-11-02", documentUrl: "",
    }));
    expect(result).toMatchObject({ kind: "success", href: `/administracion/${itemId}` });
    expect(args).toMatchObject({ p_organization_id: orgId, p_title: "Preparar informe", p_procedure_type: "Informe", p_commitment_date: "2026-11-02", p_document_status: "pending", p_document_url: null });
  });

  it("rejects an invalid link before calling the database", async () => {
    const rpc = vi.fn();
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { rpc } });
    const result = await createAdminMatter(initial, form({ ...{ title: "Informe", procedureType: "Informe", counterpartName: "Cliente" }, documentStatus: "pending", documentUrl: "javascript:alert(1)" }));
    expect(result.kind).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing authorized session", async () => {
    accessContext.mockResolvedValue({ kind: "anonymous" });
    expect((await createAdminMatter(initial, form({}))).kind).toBe("error");
  });

  it("updates only an owned active ADM detail", async () => {
    let changes: Record<string, unknown> = {};
    const check = { eq() { return this; }, is() { return this; }, async maybeSingle() { return { data: { id: itemId }, error: null }; } };
    const update = { update(value: Record<string, unknown>) { changes = value; return this; }, eq() { return this; }, select() { return this; }, async maybeSingle() { return { data: { work_item_id: itemId }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: (table: string) => table === "work_items" ? { select: () => check } : update } });
    const result = await updateAdminDetails(initial, form({ id: itemId, procedureType: "Informe", counterpartName: "Cliente", reference: "", documentStatus: "received", documentReference: "DOC-1", documentUrl: "" }));
    expect(result.kind).toBe("success");
    expect(changes).toMatchObject({ reference: null, document_status: "received", document_reference: "DOC-1", document_url: null });
  });
});
