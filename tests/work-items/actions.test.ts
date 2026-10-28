import { describe, expect, it, vi } from "vitest";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));

import { updateWorkItem } from "../../src/features/work-items/actions";

describe("updateWorkItem", () => {
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
