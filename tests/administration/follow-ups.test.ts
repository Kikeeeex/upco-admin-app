import { describe, expect, it, vi } from "vitest";
import { parseFollowUpInput, parseFollowUpResult, parseFollowUpReschedule } from "../../src/features/administration/follow-ups";

const itemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const followUpId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("administrative follow-up rules", () => {
  it("requires a valid date, contact and reason", () => {
    expect(parseFollowUpInput({ workItemId: itemId, scheduledFor: "2026-11-02", contactName: "  Cliente A ", reason: " Confirmar entrega " }))
      .toMatchObject({ contactName: "Cliente A", reason: "Confirmar entrega" });
    expect(() => parseFollowUpInput({ workItemId: itemId, scheduledFor: "2026-02-30", contactName: "A", reason: "B" })).toThrow();
    expect(() => parseFollowUpInput({ workItemId: itemId, scheduledFor: "2026-11-02", contactName: " ", reason: "B" })).toThrow();
  });

  it("requires a result to complete and a date to reschedule", () => {
    expect(parseFollowUpResult({ id: followUpId, workItemId: itemId, outcome: " Entrega recibida " }).outcome).toBe("Entrega recibida");
    expect(() => parseFollowUpResult({ id: followUpId, workItemId: itemId, outcome: " " })).toThrow();
    expect(parseFollowUpReschedule({ id: followUpId, workItemId: itemId, scheduledFor: "2026-11-03" }).scheduledFor).toBe("2026-11-03");
    expect(() => parseFollowUpReschedule({ id: followUpId, workItemId: itemId, scheduledFor: "2026-02-30" })).toThrow();
  });
});

const { accessContext, revalidatePath } = vi.hoisted(() => ({ accessContext: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: accessContext }));
import { createAdminFollowUp, completeAdminFollowUp, rescheduleAdminFollowUp } from "../../src/features/administration/follow-up-actions";

const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";
const initial = { kind: "idle" as const, message: "" };
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }

describe("administrative follow-up actions", () => {
  it("creates a linked follow-up for the signed-in user", async () => {
    let inserted: Record<string, unknown> = {};
    const query = { insert(value: Record<string, unknown>) { inserted = value; return this; }, select() { return this; }, async maybeSingle() { return { data: { id: followUpId }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: () => query } });
    const result = await createAdminFollowUp(initial, form({ workItemId: itemId, scheduledFor: "2026-11-02", contactName: "Cliente A", reason: "Confirmar entrega" }));
    expect(result.kind).toBe("success");
    expect(inserted).toMatchObject({ work_item_id: itemId, created_by: userId, scheduled_for: "2026-11-02" });
    expect(revalidatePath).toHaveBeenCalledWith("/seguimientos");
  });

  it("records a result and reschedules only a pending linked follow-up", async () => {
    const updates: Record<string, unknown>[] = [];
    const query = { update(value: Record<string, unknown>) { updates.push(value); return this; }, eq() { return this; }, select() { return this; }, async maybeSingle() { return { data: { id: followUpId }, error: null }; } };
    accessContext.mockResolvedValue({ kind: "allowed", organizationId: orgId, user: { id: userId }, supabase: { from: () => query } });
    expect((await completeAdminFollowUp(initial, form({ id: followUpId, workItemId: itemId, outcome: "Entrega recibida" }))).kind).toBe("success");
    expect((await rescheduleAdminFollowUp(initial, form({ id: followUpId, workItemId: itemId, scheduledFor: "2026-11-03" }))).kind).toBe("success");
    expect(updates).toEqual([{ status: "done", outcome: "Entrega recibida" }, { scheduled_for: "2026-11-03" }]);
  });

  it("rejects unauthenticated input", async () => {
    accessContext.mockResolvedValue({ kind: "anonymous" });
    expect((await createAdminFollowUp(initial, form({}))).kind).toBe("error");
  });
});
