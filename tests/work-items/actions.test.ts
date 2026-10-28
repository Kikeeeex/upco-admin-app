import { describe, expect, it, vi } from "vitest";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));

import { createWorkItem, updateWorkItem } from "../../src/features/work-items/actions";

const userId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
const siteId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("createWorkItem", () => {
  it("saves description and site with the authorized organization", async () => {
    let saved: Record<string, unknown> = {};
    accessContext.mockResolvedValue({
      kind: "allowed", organizationId: orgId, user: { id: userId },
      supabase: { from: () => ({ async insert(value: Record<string, unknown>) { saved = value; return { error: null }; } }) },
    });
    const form = new FormData();
    form.set("title", "Preparar informe");
    form.set("area", "administration");
    form.set("priority", "medium");
    form.set("description", "  Revisar contrato  ");
    form.set("siteId", siteId);

    expect((await createWorkItem({ kind: "idle", message: "" }, form)).kind).toBe("success");
    expect(saved).toMatchObject({ organization_id: orgId, creator_id: userId, description: "Revisar contrato", site_id: siteId });
  });

  it("saves absent description and site as null", async () => {
    let saved: Record<string, unknown> = {};
    accessContext.mockResolvedValue({
      kind: "allowed", organizationId: orgId, user: { id: userId },
      supabase: { from: () => ({ async insert(value: Record<string, unknown>) { saved = value; return { error: null }; } }) },
    });
    const form = new FormData();
    form.set("title", "Nueva actividad");
    form.set("area", "general");
    form.set("priority", "medium");
    form.set("description", "");
    form.set("siteId", "");

    expect((await createWorkItem({ kind: "idle", message: "" }, form)).kind).toBe("success");
    expect(saved).toMatchObject({ description: null, site_id: null });
  });
});

describe("updateWorkItem", () => {
  it("clears description and site when the editor chooses empty values", async () => {
    let saved: Record<string, unknown> = {};
    const query = {
      update(value: Record<string, unknown>) { saved = value; return this; },
      eq() { return this; },
      is() { return this; },
      select() { return this; },
      async maybeSingle() { return { data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, error: null }; },
    };
    accessContext.mockResolvedValue({ kind: "allowed", supabase: { from: () => query }, organizationId: orgId, user: { id: userId } });
    const form = new FormData();
    form.set("id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    form.set("title", "Revisada");
    form.set("priority", "high");
    form.set("status", "in_progress");
    form.set("description", "");
    form.set("siteId", "");

    expect((await updateWorkItem({ kind: "idle", message: "" }, form)).kind).toBe("success");
    expect(saved).toMatchObject({ description: null, site_id: null });
  });

  it("does not erase new fields when an older edit form omits them", async () => {
    let saved: Record<string, unknown> = {};
    const query = {
      update(value: Record<string, unknown>) { saved = value; return this; },
      eq() { return this; }, is() { return this; }, select() { return this; },
      async maybeSingle() { return { data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, error: null }; },
    };
    accessContext.mockResolvedValue({ kind: "allowed", supabase: { from: () => query }, organizationId: orgId, user: { id: userId } });
    const form = new FormData();
    form.set("id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    form.set("title", "Actualizada desde pestaña antigua");
    form.set("priority", "high");
    form.set("status", "in_progress");

    expect((await updateWorkItem({ kind: "idle", message: "" }, form)).kind).toBe("success");
    expect(saved).not.toHaveProperty("description");
    expect(saved).not.toHaveProperty("site_id");
  });

  it("does not change an item archived after its edit form was opened", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const orgId = "22222222-2222-4222-8222-222222222222";
    const item = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organization_id: orgId,
      creator_id: userId,
      archived_at: "2026-10-28T18:00:00Z",
      title: "Original",
    };
    const predicates: Array<(row: typeof item) => boolean> = [];
    let update: Record<string, unknown> = {};
    const query = {
      update(value: Record<string, unknown>) { update = value; return this; },
      eq(field: keyof typeof item, value: string) { predicates.push((row) => row[field] === value); return this; },
      is(field: keyof typeof item, value: null) { predicates.push((row) => row[field] === value); return this; },
      select() { return this; },
      async maybeSingle() {
        if (!predicates.every((predicate) => predicate(item))) return { data: null, error: null };
        Object.assign(item, update);
        return { data: { id: item.id }, error: null };
      },
    };
    accessContext.mockResolvedValue({ kind: "allowed", supabase: { from: () => query }, organizationId: orgId, user: { id: userId } });

    const form = new FormData();
    form.set("id", item.id);
    form.set("title", "Modificada");
    form.set("area", "general");
    form.set("priority", "high");
    form.set("status", "in_progress");
    const result = await updateWorkItem({ kind: "idle", message: "" }, form);

    expect(result.kind).toBe("error");
    expect(item.title).toBe("Original");
  });
});
