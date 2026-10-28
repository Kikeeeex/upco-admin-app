import { describe, expect, it } from "vitest";
import { escapeLikePattern, hasUnsupportedSearch, localDateInTimezone, parseWorkItemFilters, workItemListHref } from "../../src/features/work-items/filters";

describe("work item filters", () => {
  it("accepts the supported filters and ignores malformed or repeated input", () => {
    expect(parseWorkItemFilters({ q: "  GEN-000001  ", area: "general", status: "in_progress", priority: "high", site: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", due: "overdue" })).toEqual({
      query: "GEN-000001", area: "general", status: "in_progress", priority: "high", site: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", due: "overdue",
    });
    expect(parseWorkItemFilters({ q: ["one", "two"], area: "foreign", due: "wrong", site: "not-a-uuid" })).toEqual({ query: "", area: "", status: "", priority: "", site: "", due: "" });
    expect(parseWorkItemFilters({ q: "a".repeat(101) }).query).toBe("");
  });

  it("escapes SQL LIKE wildcards and retains filters in page links", () => {
    expect(escapeLikePattern("50%_\\" )).toBe("50\\%\\_\\\\");
    expect(hasUnsupportedSearch("*")).toBe(true);
    expect(hasUnsupportedSearch("informe*final")).toBe(true);
    expect(hasUnsupportedSearch("informe 50%_final")).toBe(false);
    const filters = parseWorkItemFilters({ q: "Mesa", priority: "high", due: "today" });
    expect(workItemListHref(filters, 2, 3)).toBe("/mi-trabajo?q=Mesa&priority=high&due=today&activos=2&archivo=3");
  });

  it("uses the profile timezone for the local due date", () => {
    const instant = new Date("2026-10-28T02:00:00Z");
    expect(localDateInTimezone(instant, "America/Caracas")).toBe("2026-10-27");
    expect(localDateInTimezone(instant, "UTC")).toBe("2026-10-28");
    expect(localDateInTimezone(instant, "Invalid/Zone")).toBe("2026-10-27");
  });
});
