// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/procurement/vendor-import-actions", () => ({
  inspectVendorImport: vi.fn(), previewVendorImport: vi.fn(), commitVendorImport: vi.fn(),
}));
import { inspectVendorImport, previewVendorImport, commitVendorImport } from "@/features/procurement/vendor-import-actions";
import { VendorImportWizard } from "../../src/components/vendor-import-wizard";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inspectVendorImport).mockResolvedValue({ kind: "success", fileName: "test.csv", format: "csv", sheets: [], sheetName: null,
    headers: ["Proveedor", "País"], mapping: { name: 0, country: 1 }, rowsRead: 1, blankRows: 0 });
  vi.mocked(previewVendorImport).mockResolvedValue({ kind: "success", digest: "digest", rowsRead: 1, blankRows: 0,
    counts: { new: 1, match: 0, review: 0, duplicate_file: 0, error: 0 }, rows: [{ sourceRow: 2, name: "Proveedor Uno", country: "Venezuela", salesArea: "", status: "new", reason: "", errors: [], warnings: [], editable: false }] });
  vi.mocked(commitVendorImport).mockResolvedValue({ kind: "success", batchId: "id", counts: { created: 1, updated: 0, skipped: 0, rejected: 0 }, incidents: [] });
});
afterEach(cleanup);

describe("vendor import wizard", () => {
  it("requires an explicit confirmation after showing the preview", async () => {
    render(<VendorImportWizard />);
    fireEvent.change(screen.getByLabelText(/Archivo XLSX o CSV/i), { target: { files: [new File(["Proveedor,País\nProveedor Uno,Venezuela"], "test.csv", { type: "text/csv" })] } });
    fireEvent.click(screen.getByRole("button", { name: /Leer archivo/i }));
    await screen.findByText(/Mapeo de columnas/i);
    fireEvent.click(screen.getByRole("button", { name: /Generar vista previa/i }));
    await screen.findByText("Proveedor Uno");
    expect(screen.getByRole("button", { name: /Confirmar importación/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo la importación/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar importación/i }));
    await waitFor(() => expect(commitVendorImport).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/1 creados/i)).toBeInTheDocument();
  });
  it("can show only incident rows in the preview", async () => {
    vi.mocked(previewVendorImport).mockResolvedValue({ kind: "success", digest: "digest", rowsRead: 2, blankRows: 0,
      counts: { new: 1, match: 0, review: 1, duplicate_file: 0, error: 0 }, rows: [
        { sourceRow: 2, name: "Proveedor Uno", country: "", salesArea: "", status: "new", reason: "", errors: [], warnings: [], editable: false },
        { sourceRow: 3, name: "Proveedor Dudoso", country: "", salesArea: "", status: "review", reason: "Revisar coincidencia", errors: [], warnings: [], editable: false },
      ] });
    render(<VendorImportWizard />);
    fireEvent.change(screen.getByLabelText(/Archivo XLSX o CSV/i), { target: { files: [new File(["Proveedor\nUno"], "test.csv", { type: "text/csv" })] } });
    fireEvent.click(screen.getByRole("button", { name: /Leer archivo/i }));
    await screen.findByText(/Mapeo de columnas/i);
    fireEvent.click(screen.getByRole("button", { name: /Generar vista previa/i }));
    await screen.findByText("Proveedor Dudoso");
    fireEvent.click(screen.getByRole("checkbox", { name: /Solo incidencias/i }));
    expect(screen.queryByText("Proveedor Uno")).not.toBeInTheDocument();
    expect(screen.getByText("Proveedor Dudoso")).toBeInTheDocument();
  });
});
