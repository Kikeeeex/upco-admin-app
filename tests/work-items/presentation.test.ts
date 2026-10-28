import { describe, expect, it } from "vitest";
import { formatWorkItemDateTime, parsePageNumber } from "../../src/features/work-items/presentation";

describe("parsePageNumber", () => {
  it("accepts a normal page and rejects malformed or excessive offsets", () => {
    expect(parsePageNumber("2")).toBe(2);
    expect(parsePageNumber("0")).toBe(1);
    expect(parsePageNumber(["2", "3"])).toBe(1);
    expect(parsePageNumber("999999999999999999")).toBe(1);
  });
});

describe("formatWorkItemDateTime", () => {
  it("uses the configured timezone and falls back safely for an invalid one", () => {
    const instant = "2026-10-28T18:00:00Z";
    expect(formatWorkItemDateTime(instant, "America/Caracas")).toContain("14:00");
    expect(formatWorkItemDateTime(instant, "UTC")).toContain("18:00");
    expect(formatWorkItemDateTime(instant, "Invalid/Zone")).toContain("14:00");
    expect(formatWorkItemDateTime(null, "UTC")).toBe("—");
  });
});
