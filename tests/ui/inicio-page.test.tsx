import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));

import InicioPage from "../../src/app/(dashboard)/inicio/page";

describe("InicioPage data queries", () => {
  it("limits daily work to the authorized organization and excludes retired matters", async () => {
    const calls: Array<{ filters: Array<[string, string, unknown]>; range?: [number, number] }> = [];
    let fail = false;
    const supabase = {
      from(table: string) {
        if (table === "user_profiles") return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() { return { data: { timezone: "America/Caracas" }, error: null }; },
        };
        if (table !== "work_items") throw new Error(`Unexpected table ${table}`);
        const call = { filters: [] as Array<[string, string, unknown]>, range: undefined as [number, number] | undefined };
        calls.push(call);
        return {
          select() { return this; },
          eq(column: string, value: unknown) { call.filters.push(["eq", column, value]); return this; },
          neq(column: string, value: unknown) { call.filters.push(["neq", column, value]); return this; },
          is(column: string, value: unknown) { call.filters.push(["is", column, value]); return this; },
          in(column: string, value: unknown) { call.filters.push(["in", column, value]); return this; },
          lt(column: string, value: unknown) { call.filters.push(["lt", column, value]); return this; },
          order() { return this; },
          async range(start: number, end: number) {
            call.range = [start, end];
            if (fail) return { count: null, data: null, error: new Error("Database unavailable") };
            return { count: 6, data: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "ACT-1", title: "Informe", due_date: null }], error: null };
          },
        };
      },
    };
    accessContext.mockResolvedValue({
      kind: "allowed", supabase, organizationId: "22222222-2222-4222-8222-222222222222",
      user: { id: "11111111-1111-4111-8111-111111111111" },
    });

    const html = renderToStaticMarkup(await InicioPage());
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.filters).toContainEqual(["eq", "organization_id", "22222222-2222-4222-8222-222222222222"]);
      expect(call.filters).toContainEqual(["neq", "type", "administration"]);
      expect(call.filters).toContainEqual(["is", "archived_at", null]);
      expect(call.range).toEqual([0, 4]);
    }
    expect(calls[0].filters).toContainEqual(["in", "status", ["pending", "in_progress", "waiting"]]);
    expect(calls[0].filters.some(([op, column]) => op === "eq" && column === "due_date")).toBe(true);
    expect(calls[1].filters.some(([op, column]) => op === "lt" && column === "due_date")).toBe(true);
    expect(calls[2].filters).toContainEqual(["in", "status", ["waiting"]]);
    expect(html.match(/6 actividades/g)).toHaveLength(3);
    expect(html).toContain("Vencidas");
    expect(html).toContain("En espera");

    fail = true;
    const errorHtml = renderToStaticMarkup(await InicioPage());
    expect(errorHtml).toContain("No se pudieron cargar las actividades vencidas");
    expect(errorHtml).not.toContain("0 actividades");
  });
});
