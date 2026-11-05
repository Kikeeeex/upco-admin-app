import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));
vi.mock("@/features/procurement/vendor-actions", () => ({ updateVendor: async () => ({}) }));
vi.mock("@/features/procurement/vendor-rules", async () => import("../../src/features/procurement/vendor-rules"));
import VendorDetailPage from "../../src/app/(dashboard)/procura/proveedores/[id]/page";

const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const userId = "11111111-1111-4111-8111-111111111111";
const vendor = { id, organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", created_by: userId, archived_at: null,
  name: "Proveedor Uno", country: "Venezuela", tax_identifier: "J-001", phone: "+58 0414-000",
  email: "ventas@example.com", sales_area: "Por clasificar", contact_name: "Ana", website: "www.example.com",
  city: "Caracas", products_services_detail: "Válvulas", notes: "Nota legada", associated_area: "it",
  created_at: "2026-11-05T10:00:00Z", updated_at: "2026-11-05T10:00:00Z" };

describe("vendor detail", () => {
  it("shows the ten commercial fields without linking an unverified website", async () => {
    const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: vendor, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", user: { id: userId }, organizationId: vendor.organization_id, supabase: { from: () => query } });
    const html = renderToStaticMarkup(await VendorDetailPage({ params: Promise.resolve({ id }) }));
    for (const label of ["Proveedor", "País", "RIF / identificación fiscal", "Teléfono", "Correo electrónico", "Área de venta", "Persona de contacto", "Sitio web", "Ciudad", "Detalle de productos y servicios"])
      expect(html).toContain(label);
    expect(html).toContain("Por clasificar");
    expect(html).toContain("www.example.com");
    expect(html).not.toContain('href="www.example.com"');
    expect(html).toContain("Editar proveedor");
  });
});
