import type { getAccessContext } from "@/features/auth/access";
import type { AgendaItem } from "@/components/follow-up-list";

type AllowedContext = Extract<Awaited<ReturnType<typeof getAccessContext>>, { kind: "allowed" }>;

export async function loadPendingAdminFollowUps(access: AllowedContext, limit: number, page = 1): Promise<{ items: AgendaItem[]; hasNext: boolean; error: boolean }> {
  const result = await access.supabase.from("follow_ups")
    .select("id, work_item_id, scheduled_for, contact_name, reason, work_items!inner(id, code, title, organization_id, type, archived_at)")
    .eq("status", "pending")
    .eq("work_items.organization_id", access.organizationId)
    .eq("work_items.type", "administration")
    .is("work_items.archived_at", null)
    .order("scheduled_for", { ascending: true })
    .range((page - 1) * limit, page * limit);
  const rows = (result.data ?? []) as unknown as AgendaItem[];
  return { items: rows.slice(0, limit), hasNext: rows.length > limit, error: Boolean(result.error) };
}
