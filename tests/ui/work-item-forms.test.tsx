import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/features/work-items/actions", () => ({
  createWorkItem: async () => ({ kind: "success", message: "" }),
  updateWorkItem: async () => ({ kind: "success", message: "" }),
  archiveWorkItem: async () => ({ kind: "success", message: "" }),
  restoreWorkItem: async () => ({ kind: "success", message: "" }),
  addWorkItemNote: async () => ({ kind: "success", message: "" }),
}));
import { CreateWorkItemForm, EditWorkItemForm } from "../../src/components/work-item-forms";

const sites = [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", code: "MCB", name: "Maracaibo" }];

describe("activity forms", () => {
  it("offers description and authorized sites when creating", () => {
    const html = renderToStaticMarkup(<CreateWorkItemForm sites={sites} />);
    expect(html).toContain('name="description"');
    expect(html).toContain('name="siteId"');
    expect(html).toContain('value="dddddddd-dddd-4ddd-8ddd-dddddddddddd"');
    expect(html).toContain("MCB · Maracaibo");
  });

  it("prefills description and site when editing", () => {
    const html = renderToStaticMarkup(<EditWorkItemForm sites={sites} item={{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "ADM-1", type: "administration", title: "Preparar informe",
      description: "Revisar contrato", site_id: sites[0].id, status: "pending", priority: "medium", creator_id: "11111111-1111-4111-8111-111111111111",
      due_date: null, closed_at: null, archived_at: null,
    }} />);
    expect(html).toContain("Revisar contrato</textarea>");
    expect(html).toContain('value="dddddddd-dddd-4ddd-8ddd-dddddddddddd" selected=""');
  });

  it("explains why no site can be selected yet", () => {
    const html = renderToStaticMarkup(<CreateWorkItemForm sites={[]} />);
    expect(html).toContain("No hay sedes configuradas");
    expect(html).toContain("Sin sede");
  });

  it("preserves an assigned site if the catalog cannot be loaded", () => {
    const html = renderToStaticMarkup(<EditWorkItemForm sites={[]} item={{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "ADM-1", type: "administration", title: "Preparar informe",
      description: null, site_id: sites[0].id, status: "pending", priority: "medium", creator_id: "11111111-1111-4111-8111-111111111111",
      due_date: null, closed_at: null, archived_at: null,
    }} />);
    expect(html).toContain('value="dddddddd-dddd-4ddd-8ddd-dddddddddddd" selected=""');
    expect(html).toContain("Sede no disponible");
  });
});
