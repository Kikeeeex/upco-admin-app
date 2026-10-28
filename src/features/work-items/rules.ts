import { z } from "zod";

export const workItemStatuses = ["pending", "in_progress", "waiting", "completed", "cancelled"] as const;

const validDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

const workItemInput = z.object({
  title: z.string().trim().min(1).max(200),
  area: z.enum(["general", "administration", "procurement", "it"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  dueDate: validDate.optional(),
});

export type WorkItemInput = z.infer<typeof workItemInput>;

const workItemUpdate = workItemInput.omit({ area: true }).extend({
  id: z.uuid(),
  status: z.enum(workItemStatuses),
});

export type WorkItemUpdate = z.infer<typeof workItemUpdate>;

export function parseWorkItemInput(value: unknown): WorkItemInput {
  return workItemInput.parse(value);
}

export function parseWorkItemUpdate(value: unknown): WorkItemUpdate {
  return workItemUpdate.parse(value);
}

export function isOverdue(
  dueDate: string | null,
  status: (typeof workItemStatuses)[number],
  localToday: string,
): boolean {
  return Boolean(dueDate && dueDate < localToday && status !== "completed" && status !== "cancelled");
}
