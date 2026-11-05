// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AppShell } from "../../src/components/app-shell";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("collapsible sidebar", () => {
  it("uses the dedicated white logo for the collapsed presentation", () => {
    expect(existsSync(resolve("public/brand/logo-upco-blanco.png"))).toBe(true);
    const { container } = render(<AppShell><p>Contenido</p></AppShell>);
    expect(decodeURIComponent(container.querySelector(".brand-logo-expanded")?.getAttribute("src") ?? "")).toContain("/brand/upco-logo-light.png");
    expect(decodeURIComponent(container.querySelector(".brand-logo-collapsed")?.getAttribute("src") ?? "")).toContain("/brand/logo-upco-blanco.png");
  });

  it("collapses to labeled icon links and expands again", () => {
    render(<AppShell><p>Contenido</p></AppShell>);
    const sidebar = screen.getByRole("complementary");
    fireEvent.click(screen.getByRole("button", { name: "Contraer menú lateral" }));
    expect(sidebar).toHaveClass("is-collapsed");
    expect(screen.getByRole("button", { name: "Expandir menú lateral" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Procura" })).toHaveAttribute("title", "Procura");
    fireEvent.click(screen.getByRole("button", { name: "Expandir menú lateral" }));
    expect(sidebar).not.toHaveClass("is-collapsed");
  });

  it("restores the chosen width on a new render", async () => {
    window.localStorage.setItem("upco-sidebar-collapsed", "true");
    render(<AppShell><p>Contenido</p></AppShell>);
    await waitFor(() => expect(screen.getByRole("complementary")).toHaveClass("is-collapsed"));
  });
});
