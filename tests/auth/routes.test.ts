import { describe, expect, it } from "vitest";
import { isProtectedPath } from "../../src/features/auth/routes";

describe("isProtectedPath", () => {
  it("protects dashboard pages and their nested routes", () => {
    expect(isProtectedPath("/mi-trabajo")).toBe(true);
    expect(isProtectedPath("/mi-trabajo/123")).toBe(true);
    expect(isProtectedPath("/procura")).toBe(true);
  });

  it("leaves login and similar public paths available", () => {
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
    expect(isProtectedPath("/mi-trabajo-fake")).toBe(false);
  });
});
