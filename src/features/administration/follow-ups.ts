import { z } from "zod";

const ids = z.object({ workItemId: z.uuid(), id: z.uuid() });
const newFollowUp = z.object({
  workItemId: z.uuid(),
  scheduledFor: z.iso.date(),
  contactName: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(500),
});
const result = ids.extend({ outcome: z.string().trim().min(1).max(2000) });
const reschedule = ids.extend({ scheduledFor: z.iso.date() });

export type FollowUpInput = z.infer<typeof newFollowUp>;
export type FollowUpResult = z.infer<typeof result>;
export type FollowUpReschedule = z.infer<typeof reschedule>;

export function parseFollowUpInput(value: unknown): FollowUpInput { return newFollowUp.parse(value); }
export function parseFollowUpResult(value: unknown): FollowUpResult { return result.parse(value); }
export function parseFollowUpReschedule(value: unknown): FollowUpReschedule { return reschedule.parse(value); }

export type AdminFollowUp = {
  id: string; work_item_id: string; scheduled_for: string; contact_name: string; reason: string;
  status: "pending" | "done"; outcome: string | null; performed_at: string | null;
};
