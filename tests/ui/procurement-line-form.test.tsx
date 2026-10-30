// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/features/procurement/request-actions", () => ({ createProcurementRequest: async () => ({}), updateProcurementRequester: async () => ({}) }));
vi.mock("@/features/procurement/vendor-rules", async () => import("../../src/features/procurement/vendor-rules"));
import { CreateProcurementRequestForm } from "../../src/components/procurement-request-form";

afterEach(cleanup);

describe("multi-article procurement form", () => {
  it("groups the existing fields and announces the article count", () => {
    const { container } = render(<CreateProcurementRequestForm sites={[{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", code: "MAR", name: "Maracaibo" }]} vendors={[{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Proveedor A" }]} />);
    expect(screen.getByRole("group", { name: "Artículos solicitados" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Destino y proveedor" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Solicitante y necesidad" })).toBeTruthy();
    expect(screen.getByText("1 artículo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agregar artículo" }));
    expect(screen.getByText("2 artículos")).toBeTruthy();
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const names = Array.from(new FormData(form!).keys());
    for (const name of ["siteId", "vendorId", "reference", "requesterFirstName", "requesterLastName", "requesterArea", "need"]) expect(names).toContain(name);
    expect(names.filter((name) => name === "article")).toHaveLength(2);
    expect(names.filter((name) => name === "partNumber")).toHaveLength(2);
    expect(names.filter((name) => name === "quantity")).toHaveLength(2);
    expect(names.filter((name) => name === "unit")).toHaveLength(2);
  });

  it("adds and removes article rows while keeping one required row", () => {
    render(<CreateProcurementRequestForm sites={[{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", code: "MAR", name: "Maracaibo" }]} vendors={[]} />);
    expect(screen.getAllByRole("textbox", { name: "Artículo o servicio" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Agregar artículo" }));
    expect(screen.getAllByRole("textbox", { name: "Artículo o servicio" })).toHaveLength(2);
    expect(screen.getAllByRole("spinbutton", { name: "Cantidad" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Quitar artículo 2" }));
    expect(screen.getAllByRole("textbox", { name: "Artículo o servicio" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Quitar artículo 1" })).toBeNull();
  });
});
