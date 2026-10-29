import { describe, expect, it } from "vitest";
import { loadPendingAdminFollowUps } from "../../src/features/administration/agenda";

describe("administrative follow-up agenda query", () => {
  it("loads only pending active ADM follow-ups in the selected organization", async () => {
    const filters: Array<[string, string, unknown]> = [];
    let range: [number, number] | undefined;
    const query = { select() { return this; }, eq(key: string, value: unknown) { filters.push(["eq", key, value]); return this; },
      is(key: string, value: unknown) { filters.push(["is", key, value]); return this; }, order() { return this; },
      async range(start: number, end: number) { range = [start, end]; return { data: [{ id: "x", scheduled_for: "2026-11-02", work_items: { id: "y", code: "ADM-000001", title: "Informe" } }], error: null }; } };
    const access = { kind: "allowed", organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", supabase: { from: () => query } };
    const result = await loadPendingAdminFollowUps(access as never, 5);
    expect(result.error).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(filters).toContainEqual(["eq", "status", "pending"]);
    expect(filters).toContainEqual(["eq", "work_items.organization_id", access.organizationId]);
    expect(filters).toContainEqual(["eq", "work_items.type", "administration"]);
    expect(filters).toContainEqual(["is", "work_items.archived_at", null]);
    expect(range).toEqual([0, 5]);
  });

  it("returns one extra row as a next-page signal without hiding later records", async () => {
    let range: [number, number] | undefined;
    const query = { select() { return this; }, eq() { return this; }, is() { return this; }, order() { return this; },
      async range(start: number, end: number) { range = [start, end]; return { data: Array.from({ length: 3 }, (_, index) => ({ id: String(index) })), error: null }; } };
    const access = { kind: "allowed", organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", supabase: { from: () => query } };
    const result = await loadPendingAdminFollowUps(access as never, 2, 2);
    expect(range).toEqual([2, 4]);
    expect(result.items).toHaveLength(2);
    expect(result.hasNext).toBe(true);
  });
});
