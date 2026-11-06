// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AppShell } from "../../src/components/app-shell";

const { pathState } = vi.hoisted(() => ({ pathState: { value: "/procura" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathState.value }));

beforeEach(() => { window.localStorage.clear(); pathState.value = "/procura"; });
afterEach(cleanup);

describe("collapsible sidebar", () => {
  it("marks the current route and names its location in the header", () => {
    render(<AppShell><p>Contenido</p></AppShell>);
    expect(screen.getByRole("navigation", { name: "Navegación principal" }).querySelector('a[href="/procura"]')).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("banner")).toHaveTextContent("Procura");
  });

  it("groups routes by work, areas and tools without losing destinations", () => {
    render(<AppShell><p>Contenido</p></AppShell>);
    const work = screen.getByRole("group", { name: "Trabajo" });
    expect(work.querySelector('a[href="/inicio"]')).toBeInTheDocument();
    expect(work.querySelector('a[href="/seguimientos"]')).toBeInTheDocument();
    const areas = screen.getByRole("group", { name: "Áreas" });
    expect(areas.querySelector('a[href="/procura"]')).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Herramientas" }).querySelector('a[href="/configuracion"]')).toBeInTheDocument();
  });

  it("provides a parent link for a nested supplier record", () => {
    pathState.value = "/procura/proveedores/123";
    render(<AppShell><p>Contenido</p></AppShell>);
    expect(screen.getByRole("banner")).toHaveTextContent("Ficha de proveedor");
    expect(screen.getByRole("navigation", { name: "Ruta actual" }).querySelector('a[href="/procura"]')).toHaveTextContent("Procura");
    expect(screen.getByRole("navigation", { name: "Navegación principal" }).querySelector('a[href="/procura"]')).toHaveAttribute("aria-current", "page");
  });

  it("opens mobile navigation and closes it after choosing a destination", async () => {
    render(<AppShell><p>Contenido</p></AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(await screen.findByRole("dialog", { name: "Navegación de UPCO Admin" })).toBeVisible();
    const destination = screen.getByRole("dialog").querySelector('a[href="/mi-trabajo"]')!;
    fireEvent.click(destination);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the mobile menu with Escape and returns focus to the trigger", async () => {
    render(<AppShell><p>Contenido</p></AppShell>);
    const trigger = screen.getByRole("button", { name: "Abrir menú" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Navegación de UPCO Admin" })).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

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
