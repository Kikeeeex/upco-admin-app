// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/features/procurement/request-actions", () => ({ createProcurementRequest: async () => ({}), updateProcurementRequester: async () => ({}) }));
vi.mock("@/features/procurement/vendor-rules", async () => import("../../src/features/procurement/vendor-rules"));
import { CreateProcurementRequestForm } from "../../src/components/procurement-request-form";

afterEach(cleanup);

describe("multi-article procurement form", () => {
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
