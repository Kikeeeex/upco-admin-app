import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { accessContext, agenda } = vi.hoisted(() => ({ accessContext: vi.fn(), agenda: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
vi.mock("@/features/administration/agenda", () => ({ loadPendingAdminFollowUps: agenda }));
vi.mock("@/features/work-items/filters", async () => import("../../src/features/work-items/filters"));
vi.mock("@/features/work-items/presentation", async () => import("../../src/features/work-items/presentation"));
vi.mock("@/components/follow-up-list", async () => import("../../src/components/follow-up-list"));
import SeguimientosPage from "../../src/app/(dashboard)/seguimientos/page";

describe("Seguimientos page", () => {
  it("shows pending ADM follow-ups and links to their matters", async () => {
    const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    accessContext.mockResolvedValue({ kind: "allowed", user: { id: "x" }, supabase: { from: () => ({ select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { timezone: "America/Caracas" }, error: null }; } }) } });
    agenda.mockResolvedValue({ error: false, items: [{ id: "y", work_item_id: id, scheduled_for: "2026-10-28", contact_name: "Cliente A", reason: "Confirmar entrega", work_items: { id, code: "ADM-000001", title: "Informe" } }] });
    const html = renderToStaticMarkup(await SeguimientosPage());
    expect(html).toContain("Agenda de seguimientos");
    expect(html).toContain("Confirmar entrega");
    expect(html).toContain(`/administracion/${id}`);
  });
  it("offers previous and next pages when more pending follow-ups exist", async () => {
    accessContext.mockResolvedValue({ kind: "allowed", user: { id: "x" }, supabase: { from: () => ({ select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { timezone: "America/Caracas" }, error: null }; } }) } });
    agenda.mockResolvedValue({ error: false, items: [], hasNext: true });
    const html = renderToStaticMarkup(await SeguimientosPage({ searchParams: Promise.resolve({ pagina: "2" }) }));
    expect(agenda).toHaveBeenCalledWith(expect.objectContaining({ kind: "allowed" }), 50, 2);
    expect(html).toContain("/seguimientos?pagina=1");
    expect(html).toContain("/seguimientos?pagina=3");
  });
});
