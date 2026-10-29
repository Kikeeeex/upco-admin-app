import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
vi.mock("@/features/administration/actions", () => ({ createAdminMatter: async () => ({}), updateAdminDetails: async () => ({}) }));
vi.mock("@/features/work-items/actions", () => ({ updateWorkItem: async () => ({}), archiveWorkItem: async () => ({}), restoreWorkItem: async () => ({}) }));
vi.mock("@/components/pending-page", async () => import("../../src/components/pending-page"));
vi.mock("@/features/work-items/presentation", async () => import("../../src/features/work-items/presentation"));
vi.mock("@/features/work-items/rules", async () => import("../../src/features/work-items/rules"));
vi.mock("@/components/admin-matter-forms", async () => import("../../src/components/admin-matter-forms"));
vi.mock("@/components/work-item-forms", async () => import("../../src/components/work-item-forms"));

import AdministrationPage from "../../src/app/(dashboard)/administracion/page";
import AdminDetailPage from "../../src/app/(dashboard)/administracion/[id]/page";

const itemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";
const matter = { id: itemId, code: "ADM-000001", type: "administration", title: "Preparar informe", description: null,
  site_id: null, due_date: "2026-11-02", status: "pending", priority: "medium", creator_id: userId, archived_at: null,
  closed_at: null, created_at: "2026-10-29T12:00:00Z", updated_at: "2026-10-29T12:00:00Z",
  admin_details: { procedure_type: "Informe", counterpart_name: "Cliente A", reference: null, document_status: "pending" } };

describe("Administration pages", () => {
  it("lists only active ADM matters in the authorized organization", async () => {
    const filters: Array<[string, unknown]> = [];
    let detailIds: string[] = [];
    const list = { select() { return this; }, eq(field: string, value: unknown) { filters.push([field, value]); return this; },
      is(field: string, value: unknown) { filters.push([field, value]); return this; }, order() { return this; },
      async range() { return { data: [{ ...matter, admin_details: undefined }], error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: (table: string) =>
      table === "work_items" ? list : table === "admin_details" ? { select() { return this; }, async in(_field: string, ids: string[]) { detailIds = ids; return { data: [{ work_item_id: itemId, procedure_type: "Informe", counterpart_name: "Cliente A", document_status: "pending" }], error: null }; } } :
        { select() { return this; }, eq() { return this; }, order: async () => ({ data: [], error: null }) } } });

    const html = renderToStaticMarkup(await AdministrationPage({ searchParams: Promise.resolve({}) }));
    expect(filters).toContainEqual(["organization_id", orgId]);
    expect(filters).toContainEqual(["type", "administration"]);
    expect(filters).toContainEqual(["archived_at", null]);
    expect(detailIds).toEqual([itemId]);
    expect(html).toContain("ADM-000001");
    expect(html).toContain("Pendiente");
    expect(html).toContain(`/administracion/${itemId}`);
  });

  it("shows the specific detail, pending documents and safe document links", async () => {
    const detail = { work_item_id: itemId, procedure_type: "Informe", counterpart_name: "Cliente A", reference: "REF-1",
      document_status: "pending", document_reference: "DOC-1", document_url: "https://example.com/documento" };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: (table: string) => {
      if (table === "sites") return { select() { return this; }, eq() { return this; }, order: async () => ({ data: [], error: null }) };
      return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === "work_items" ? matter : detail, error: null }; } };
    } } });

    const html = renderToStaticMarkup(await AdminDetailPage({ params: Promise.resolve({ id: itemId }) }));
    expect(html).toContain("Ficha de gestión administrativa");
    expect(html).toContain("Documentación pendiente");
    expect(html).toContain("Cliente A");
    expect(html).toContain('href="https://example.com/documento"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
