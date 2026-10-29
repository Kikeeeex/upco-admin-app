import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/features/administration/follow-up-actions", () => ({
  createAdminFollowUp: async () => ({}), completeAdminFollowUp: async () => ({}), rescheduleAdminFollowUp: async () => ({}),
}));
import { FollowUpAgenda } from "../../src/components/follow-up-list";
import { AdminFollowUpSection } from "../../src/components/admin-follow-up-forms";

const workItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const followUp = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", work_item_id: workItemId,
  scheduled_for: "2026-10-28", contact_name: "Cliente A", reason: "Confirmar entrega",
  status: "pending" as const, outcome: null, performed_at: null };

describe("follow-up views", () => {
  it("links an overdue pending item back to its ADM matter", () => {
    const html = renderToStaticMarkup(<FollowUpAgenda today="2026-10-29" items={[{ ...followUp, work_items: { id: workItemId, code: "ADM-000001", title: "Informe" } }]} />);
    expect(html).toContain("Vencido");
    expect(html).toContain("Confirmar entrega");
    expect(html).toContain(`/administracion/${workItemId}`);
  });

  it("shows a result and scheduling controls only for the active owner", () => {
    const done = { ...followUp, status: "done" as const, outcome: "Entrega confirmada", performed_at: "2026-10-29T12:00:00Z" };
    const owner = renderToStaticMarkup(<AdminFollowUpSection workItemId={workItemId} items={[followUp, done]} canEdit />);
    expect(owner).toContain("Programar seguimiento");
    expect(owner).toContain("Registrar resultado");
    expect(owner).toContain("Entrega confirmada");
    const reader = renderToStaticMarkup(<AdminFollowUpSection workItemId={workItemId} items={[followUp]} canEdit={false} />);
    expect(reader).not.toContain("Programar seguimiento");
    expect(reader).not.toContain("Registrar resultado");
  });
});
