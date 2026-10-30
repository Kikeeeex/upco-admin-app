import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
vi.mock("@/features/procurement/vendor-actions", () => ({ createVendor: async () => ({}), updateVendor: async () => ({}), archiveVendor: async () => ({}), restoreVendor: async () => ({}), deleteVendorPermanently: async () => ({}) }));
vi.mock("@/features/procurement/request-actions", () => ({ createProcurementRequest: async () => ({}) }));
vi.mock("@/features/work-items/actions", () => ({ updateWorkItem: async () => ({}), archiveWorkItem: async () => ({}), restoreWorkItem: async () => ({}) }));
vi.mock("@/features/work-items/presentation", async () => import("../../src/features/work-items/presentation"));
vi.mock("@/features/work-items/rules", async () => import("../../src/features/work-items/rules"));
vi.mock("@/features/procurement/vendor-rules", async () => import("../../src/features/procurement/vendor-rules"));
vi.mock("@/components/pending-page", async () => import("../../src/components/pending-page"));
vi.mock("@/components/vendor-forms", async () => import("../../src/components/vendor-forms"));
vi.mock("@/components/work-item-forms", async () => import("../../src/components/work-item-forms"));
vi.mock("@/components/procurement-request-form", async () => import("../../src/components/procurement-request-form"));

import ProcurementPage from "../../src/app/(dashboard)/procura/page";
import RequestDetailPage from "../../src/app/(dashboard)/procura/[id]/page";

const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";
const itemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const site = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", code: "MAR", name: "Maracaibo" };
const vendor = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "Proveedor A", associated_area: "it", contact_name: null, email: null, phone: null, notes: null, archived_at: null, created_by: userId, created_at: "2026-10-30T10:00:00Z", updated_at: "2026-10-30T10:00:00Z" };
const item = { id: itemId, code: "PRC-000001", type: "procurement", title: "Guantes", description: null, site_id: site.id, status: "pending", priority: "medium", due_date: null, closed_at: null, archived_at: null, creator_id: userId, created_at: "2026-10-30T10:00:00Z", updated_at: "2026-10-30T10:00:00Z" };
const detail = { work_item_id: itemId, quantity: 2.5, unit: "cajas", need: "Reponer inventario", reference: "REF-1", vendor_id: vendor.id, vendor_name: vendor.name };

function client() {
  return { from: (table: string) => ({
    select() { return this; }, eq() { return this; }, is() { return this; }, not() { return this; }, gte() { return this; }, order() { return this; }, in() { return Promise.resolve({ data: [detail], error: null }); },
    range() { return Promise.resolve({ data: table === "work_items" ? [item] : table === "vendors" ? [vendor] : [], error: null }); },
    maybeSingle() { return Promise.resolve({ data: table === "work_items" ? item : table === "procurement_details" ? detail : { timezone: "America/Caracas" }, error: null }); },
    then(resolve: (value: unknown) => void) { return Promise.resolve({ data: table === "sites" ? [site] : [], error: null }).then(resolve); },
  }) };
}

describe("procurement request pages", () => {
  it("offers creation with destination site and active vendor, then lists the PRC row", async () => {
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: client() });
    const html = renderToStaticMarkup(await ProcurementPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Nueva solicitud");
    expect(html).toContain('name="quantity"');
    expect(html).toContain('name="siteId"');
    expect(html).toContain("Proveedor A");
    expect(html).toContain("PRC-000001");
    expect(html).toContain(`/procura/${itemId}`);
  });

  it("shows quantity, destination, need and supplier snapshot on its ficha", async () => {
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: client() });
    const html = renderToStaticMarkup(await RequestDetailPage({ params: Promise.resolve({ id: itemId }) }));
    for (const value of ["PRC-000001", "2,5", "cajas", "Maracaibo", "Reponer inventario", "Proveedor A", "REF-1"])
      expect(html).toContain(value);
    expect(html).toContain(`<select id="site-${itemId}" name="siteId" required=""`);
  });

  it("offers active vendors beyond the first thousand", async () => {
    const options = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), name: `Proveedor ${i + 1}` }));
    const base = client();
    const vendorQuery = { select() { return this; }, eq() { return this; }, is() { return this; }, not() { return this; }, gte() { return this; }, order() { return this; },
      async range(start: number, end: number) { return { data: end - start >= 499 ? options.slice(start, end + 1) : [vendor], error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: {
      from: (table: string) => table === "vendors" ? vendorQuery : base.from(table),
    } });
    const html = renderToStaticMarkup(await ProcurementPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Proveedor 1001");
  });
});
