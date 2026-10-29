import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
vi.mock("@/features/work-items/filters", async () => import("../../src/features/work-items/filters"));
vi.mock("@/features/work-items/daily", async () => import("../../src/features/work-items/daily"));
vi.mock("@/components/daily-panel", async () => import("../../src/components/daily-panel"));
vi.mock("@/features/administration/agenda", async () => import("../../src/features/administration/agenda"));
vi.mock("@/components/follow-up-list", async () => import("../../src/components/follow-up-list"));

import InicioPage from "../../src/app/(dashboard)/inicio/page";

describe("InicioPage data queries", () => {
  it("counts only active work in the authorized organization and limits each list", async () => {
    const calls: Array<{ select: unknown[]; filters: Array<[string, string, unknown]>; range?: [number, number] }> = [];
    let fail = false;
    const supabase = {
      from(table: string) {
        if (table === "user_profiles") return {
          select() { return this; }, eq() { return this; },
          async maybeSingle() { return { data: { timezone: "America/Caracas" }, error: null }; },
        };
        if (table === "follow_ups") return {
          select() { return this; }, eq() { return this; }, is() { return this; }, order() { return this; },
          async range() { return { data: [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", work_item_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", scheduled_for: "2026-11-02", contact_name: "Cliente A", reason: "Confirmar entrega", work_items: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", code: "ADM-000001", title: "Informe" } }], error: null }; },
        };
        if (table !== "work_items") throw new Error(`Unexpected table ${table}`);
        const call = { select: [] as unknown[], filters: [] as Array<[string, string, unknown]>, range: undefined as [number, number] | undefined };
        calls.push(call);
        return {
          select(...args: unknown[]) { call.select = args; return this; },
          eq(column: string, value: unknown) { call.filters.push(["eq", column, value]); return this; },
          is(column: string, value: unknown) { call.filters.push(["is", column, value]); return this; },
          in(column: string, value: unknown) { call.filters.push(["in", column, value]); return this; },
          lt(column: string, value: unknown) { call.filters.push(["lt", column, value]); return this; },
          order() { return this; },
          async range(start: number, end: number) {
            call.range = [start, end];
            if (fail) return { count: null, data: null, error: new Error("Database unavailable") };
            return { count: 6, data: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "ADM-1", title: "Informe", due_date: null }], error: null };
          },
        };
      },
    };
    accessContext.mockResolvedValue({ kind: "allowed", supabase, organizationId: "22222222-2222-4222-8222-222222222222", user: { id: "11111111-1111-4111-8111-111111111111" } });

    const html = renderToStaticMarkup(await InicioPage());
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.select[1]).toEqual({ count: "exact" });
      expect(call.filters).toContainEqual(["eq", "organization_id", "22222222-2222-4222-8222-222222222222"]);
      expect(call.filters).toContainEqual(["is", "archived_at", null]);
      expect(call.range).toEqual([0, 4]);
    }
    expect(calls[0].filters).toContainEqual(["in", "status", ["pending", "in_progress", "waiting"]]);
    expect(calls[0].filters.some(([op, column]) => op === "eq" && column === "due_date")).toBe(true);
    expect(calls[1].filters.some(([op, column]) => op === "lt" && column === "due_date")).toBe(true);
    expect(calls[2].filters).toContainEqual(["in", "status", ["waiting"]]);
    expect(html.match(/6 actividades/g)).toHaveLength(3);
    expect(html).toContain("Próximos seguimientos");
    expect(html).toContain("Confirmar entrega");

    fail = true;
    const errorHtml = renderToStaticMarkup(await InicioPage());
    expect(errorHtml).toContain("No se pudieron cargar las actividades vencidas");
    expect(errorHtml).not.toContain("0 actividades");
  });
});
