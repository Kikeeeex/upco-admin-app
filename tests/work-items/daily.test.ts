import { describe, expect, it } from "vitest";
import { dailyBuckets } from "../../src/features/work-items/daily";

describe("dailyBuckets", () => {
  it("uses the profile day and open states for today's and overdue work", () => {
    expect(dailyBuckets("2026-10-28")).toEqual([
      { key: "today", title: "Para hoy", href: "/mi-trabajo?due=today", dateFilter: { operator: "eq", value: "2026-10-28" }, statuses: ["pending", "in_progress", "waiting"] },
      { key: "overdue", title: "Vencidas", href: "/mi-trabajo?due=overdue", dateFilter: { operator: "lt", value: "2026-10-28" }, statuses: ["pending", "in_progress", "waiting"] },
      { key: "waiting", title: "En espera", href: "/mi-trabajo?status=waiting", dateFilter: null, statuses: ["waiting"] },
    ]);
  });
});
