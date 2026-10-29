import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
vi.mock("@/features/procurement/vendor-actions", () => ({ createVendor: async () => ({}), updateVendor: async () => ({}), archiveVendor: async () => ({}), restoreVendor: async () => ({}) }));
vi.mock("@/features/procurement/vendor-rules", async () => import("../../src/features/procurement/vendor-rules"));
vi.mock("@/features/work-items/presentation", async () => import("../../src/features/work-items/presentation"));
vi.mock("@/components/pending-page", async () => import("../../src/components/pending-page"));
vi.mock("@/components/vendor-forms", async () => import("../../src/components/vendor-forms"));
import ProcurementPage from "../../src/app/(dashboard)/procura/page";

const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";
const row = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Acme S.A.", contact_name: "Ana",
  email: "ana@example.com", phone: null, notes: "Entrega local", associated_area: "procurement", archived_at: null, created_by: userId,
  created_at: "2026-10-29T12:00:00Z", updated_at: "2026-10-29T12:00:00Z" };

describe("Procura vendor catalog", () => {
  it("renders creation and editable vendors scoped to the authorized organization", async () => {
    const filters: Array<[string, unknown]> = [];
    const vendors = { select() { return this; }, eq(key: string, value: unknown) { filters.push([key, value]); return this; },
      is() { return this; }, not() { return this; }, order() { return this; }, async range() { return { data: [row], error: null }; } };
    const profile = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { timezone: "America/Caracas" }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: (table: string) => table === "vendors" ? vendors : profile } });
    const html = renderToStaticMarkup(await ProcurementPage({ searchParams: Promise.resolve({}) }));
    expect(filters).toContainEqual(["organization_id", orgId]);
    expect(html).toContain("Nuevo proveedor");
    expect(html).toContain("Acme S.A.");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("Editar proveedor");
    expect(html).toContain("Área asociada");
    expect(html).toContain("Eliminar proveedor");
    expect(html).toContain("Procura");
  });

  it("paginates after 50 vendors without hiding the next page", async () => {
    const ranges: Array<[number, number]> = [];
    const vendors = { select() { return this; }, eq() { return this; }, is() { return this; }, not() { return this; }, order() { return this; },
      async range(start: number, end: number) { ranges.push([start, end]); return { data: Array.from({ length: 51 }, (_, i) => ({ ...row, id: String(i), name: `Proveedor ${i}` })), error: null }; } };
    const profile = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { timezone: "America/Caracas" }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: (table: string) => table === "vendors" ? vendors : profile } });
    const html = renderToStaticMarkup(await ProcurementPage({ searchParams: Promise.resolve({ pagina: "2", archivoPagina: "3" }) }));
    expect(ranges).toContainEqual([50, 100]);
    expect(ranges).toContainEqual([100, 150]);
    expect(html).toContain("/procura?pagina=1&amp;archivoPagina=3");
    expect(html).toContain("/procura?pagina=3&amp;archivoPagina=3");
    expect(html).not.toContain("Proveedor 50");
  });

  it("lists archived vendors with a restore action", async () => {
    const archived = { ...row, archived_at: "2026-10-29T13:00:00Z" };
    const vendors = { select() { return this; }, eq() { return this; }, is() { return this; },
      not() { return this; }, order() { return this; }, async range() { return { data: [archived], error: null }; } };
    const profile = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { timezone: "America/Caracas" }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: (table: string) => table === "vendors" ? vendors : profile } });
    const html = renderToStaticMarkup(await ProcurementPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Proveedores eliminados");
    expect(html).toContain("Restaurar proveedor");
  });
});
