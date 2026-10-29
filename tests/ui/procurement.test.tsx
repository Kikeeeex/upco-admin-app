import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
vi.mock("@/features/procurement/vendor-actions", () => ({ createVendor: async () => ({}), updateVendor: async () => ({}) }));
vi.mock("@/features/work-items/presentation", async () => import("../../src/features/work-items/presentation"));
vi.mock("@/components/pending-page", async () => import("../../src/components/pending-page"));
vi.mock("@/components/vendor-forms", async () => import("../../src/components/vendor-forms"));
import ProcurementPage from "../../src/app/(dashboard)/procura/page";

const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";
const row = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Acme S.A.", contact_name: "Ana",
  email: "ana@example.com", phone: null, notes: "Entrega local", created_by: userId,
  created_at: "2026-10-29T12:00:00Z", updated_at: "2026-10-29T12:00:00Z" };

describe("Procura vendor catalog", () => {
  it("renders creation and editable vendors scoped to the authorized organization", async () => {
    const filters: Array<[string, unknown]> = [];
    const vendors = { select() { return this; }, eq(key: string, value: unknown) { filters.push([key, value]); return this; },
      order() { return this; }, async range() { return { data: [row], error: null }; } };
    const profile = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { timezone: "America/Caracas" }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: (table: string) => table === "vendors" ? vendors : profile } });
    const html = renderToStaticMarkup(await ProcurementPage({ searchParams: Promise.resolve({}) }));
    expect(filters).toContainEqual(["organization_id", orgId]);
    expect(html).toContain("Nuevo proveedor");
    expect(html).toContain("Acme S.A.");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("Editar proveedor");
  });

  it("paginates after 50 vendors without hiding the next page", async () => {
    let range: [number, number] | undefined;
    const vendors = { select() { return this; }, eq() { return this; }, order() { return this; },
      async range(start: number, end: number) { range = [start, end]; return { data: Array.from({ length: 51 }, (_, i) => ({ ...row, id: String(i), name: `Proveedor ${i}` })), error: null }; } };
    const profile = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { timezone: "America/Caracas" }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: (table: string) => table === "vendors" ? vendors : profile } });
    const html = renderToStaticMarkup(await ProcurementPage({ searchParams: Promise.resolve({ pagina: "2" }) }));
    expect(range).toEqual([50, 100]);
    expect(html).toContain("/procura?pagina=1");
    expect(html).toContain("/procura?pagina=3");
    expect(html).not.toContain("Proveedor 50");
  });
});
