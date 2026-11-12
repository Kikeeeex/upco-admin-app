import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { accessContext } = vi.hoisted(() => ({ accessContext: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
vi.mock("@/features/administration/reports/status", () => ({
  loadAdministrationDraftStatus: async () => ({
    total: 2, issued: 1, invoices: 1, creditNotes: 0, debitNotes: 0,
    islrMarked: 0, igtfMarked: 0, periods: 1, error: false,
  }),
}));
vi.mock("@/features/administration/permissions/access-control", () => ({
  hasAnyAdministrationPermission: () => true,
  requireAnyAdministrationPermission: () => undefined,
}));

import AdministrationPage from "../../src/app/(dashboard)/administracion/page";

describe("Administration V2 overview", () => {
  it("shows current modules and scopes its document queries to the organization", async () => {
    const queryFilters: Array<[string, string, unknown]> = [];
    const supabase = {
      from(table: string) {
        return {
          select() { return this; },
          eq(field: string, value: unknown) { queryFilters.push([table, field, value]); return this; },
          order() { return this; },
          async limit() { return { data: [], error: null }; },
        };
      },
    };
    accessContext.mockResolvedValue({
      kind: "allowed", supabase, organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      user: { id: "11111111-1111-4111-8111-111111111111" },
    });

    const html = renderToStaticMarkup(await AdministrationPage());
    expect(queryFilters).toEqual([
      ["administration_documents", "organization_id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      ["administration_documents", "status", "draft"],
      ["fiscal_vendors", "organization_id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    ]);
    expect(html).toContain("ADMINISTRACIÓN V2.8");
    expect(html).toContain("Resumen");
    expect(html).toContain("Compras y documentos");
    expect(html).toContain("Proveedores");
    expect(html).not.toContain("/seguimientos");
  });
});
