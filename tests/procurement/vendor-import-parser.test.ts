import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
vi.mock("server-only", () => ({}));
import { readVendorFile, guessVendorMapping, mapVendorRows } from "../../src/features/procurement/vendor-import-parser";

const headers = ["Proveedor", "País", "RIF / identificación fiscal", "Teléfono", "Correo electrónico", "Área de venta", "Persona de contacto", "Sitio web", "Ciudad", "Detalle de productos y servicios"];

function csvFile(text: string, name = "proveedores.csv") { return new File([text], name, { type: "text/csv" }); }

describe("vendor directory file parser", () => {
  it("reads a synthetic XLSX A:J and ignores the auxiliary M column", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Directorio de Proveedores");
    sheet.addRow([...headers, null, null, null]);
    const row = sheet.addRow(["Proveedor Uno", "Venezuela", "J-001", "+58 0414-000", "ventas@example.com", "Por clasificar", "Ana", "www.example.com", "Caracas", "Válvulas"]);
    row.getCell(13).value = "Instrucción interna: no importar";
    const file = new File([await book.xlsx.writeBuffer()], "directorio.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const parsed = await readVendorFile(file);
    expect(parsed.sheetName).toBe("Directorio de Proveedores");
    expect(parsed.rows).toHaveLength(1);
    const mapping = guessVendorMapping(parsed.headers);
    expect(Object.values(mapping)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const mapped = mapVendorRows(parsed, mapping);
    expect(mapped[0].data).toMatchObject({ name: "Proveedor Uno", taxIdentifier: "J-001", phone: "+58 0414-000", salesArea: "Por clasificar", productsServicesDetail: "Válvulas" });
    expect(JSON.stringify(mapped)).not.toContain("Instrucción interna");
  });

  it("reads BOM, semicolon CSV and quoted multiline descriptions with source lines", async () => {
    const text = `\uFEFF${headers.join(";")}\nProveedor Uno;Venezuela;J-001;+58 0414-000;ventas@example.com;Por clasificar;Ana;www.example.com;Caracas;"Válvulas; y\nservicios"\nProveedor Dos;;;;;;;;;`;
    const parsed = await readVendorFile(csvFile(text));
    expect(parsed.rows.map((row) => row.sourceRow)).toEqual([2, 4]);
    const mapped = mapVendorRows(parsed, guessVendorMapping(parsed.headers));
    expect(mapped[0].data?.productsServicesDetail).toBe("Válvulas; y\nservicios");
    expect(mapped[1].data?.name).toBe("Proveedor Dos");
  });

  it("rejects unsupported extensions, corrupt XLSX and formulas in mapped cells", async () => {
    await expect(readVendorFile(csvFile("Proveedor\nUno", "datos.xlx"))).rejects.toThrow();
    await expect(readVendorFile(new File(["not a zip"], "datos.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))).rejects.toThrow();
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Directorio de Proveedores");
    sheet.addRow(headers);
    sheet.addRow([{ formula: "1+1", result: "Proveedor Uno" }]);
    const file = new File([await book.xlsx.writeBuffer()], "formula.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const parsed = await readVendorFile(file);
    const mapped = mapVendorRows(parsed, guessVendorMapping(parsed.headers));
    expect(mapped[0].errors).toContain("La fila contiene una fórmula en una columna asignada.");
  });
});
