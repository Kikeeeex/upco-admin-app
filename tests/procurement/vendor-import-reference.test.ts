import { expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
vi.mock("server-only", () => ({}));
import { readVendorFile, guessVendorMapping, mapVendorRows } from "../../src/features/procurement/vendor-import-parser";
import { analyzeVendorRows } from "../../src/features/procurement/vendor-import-rules";

const referencePath = process.env.UPCO_VENDOR_EXCEL_PATH;
it.skipIf(!referencePath)("reads the separately supplied UPCO workbook without auxiliary column M", async () => {
  const bytes = await readFile(referencePath!);
  const file = new File([new Uint8Array(bytes)], "Directorio de Proveedores.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const parsed = await readVendorFile(file);
  const mapping = guessVendorMapping(parsed.headers);
  const rows = mapVendorRows(parsed, mapping);
  expect(parsed.sheetName).toBe("Directorio de Proveedores");
  expect(parsed.rows).toHaveLength(81);
  expect(Object.values(mapping)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(rows).toHaveLength(81);
  expect(rows.filter((row) => !row.data).map((row) => row.sourceRow)).toEqual([82]);
  expect(rows.filter((row) => row.data)).toHaveLength(80);
  expect(analyzeVendorRows(rows, []).filter((row) => row.status === "new")).toHaveLength(80);
});
