import "server-only";
import ExcelJS from "exceljs";
import yauzl from "yauzl";
import { parse as parseCsv } from "csv-parse/sync";
import { parseVendorInput, safeVendorWebsiteUrl, type VendorInput } from "./vendor-rules";
import { vendorImportFields, type VendorImportMapping } from "./vendor-import-fields";
export { vendorImportFields } from "./vendor-import-fields";
export type { VendorImportField, VendorImportMapping } from "./vendor-import-fields";

export const MAX_VENDOR_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_VENDOR_ROWS = 10_000;
export type VendorFileRow = { sourceRow: number; cells: Array<{ text: string; formula: boolean }> };
export type ParsedVendorFile = { fileName: string; format: "xlsx" | "csv"; sheetName: string | null; sheets: string[];
  headers: string[]; rows: VendorFileRow[]; blankRows: number };
export type MappedVendorRow = { sourceRow: number; data: VendorInput | null; errors: string[]; warnings: string[] };

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
}

export function guessVendorMapping(headers: string[]): VendorImportMapping {
  const mapping: VendorImportMapping = {};
  for (const field of vendorImportFields) {
    const index = headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(field.label));
    if (index >= 0) mapping[field.key] = index;
  }
  return mapping;
}

function validateMapping(headers: string[], mapping: VendorImportMapping): void {
  if (mapping.name === undefined) throw new Error("Asigna una columna a «Proveedor».");
  const used = new Set<number>();
  for (const index of Object.values(mapping)) {
    if (index === undefined) continue;
    if (!Number.isInteger(index) || index < 0 || index >= headers.length || used.has(index))
      throw new Error("El mapeo contiene columnas inexistentes o repetidas.");
    used.add(index);
  }
}

function blank(cells: Array<{ text: string; formula?: boolean }>): boolean { return cells.every((cell) => !cell.text.trim() && !cell.formula); }

async function checkXlsxArchive(buffer: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, autoClose: true }, (error, zip) => {
      if (error || !zip) return reject(new Error("El archivo XLSX no es legible."));
      let uncompressed = 0;
      let entries = 0;
      let contentTypes = false;
      let workbook = false;
      const fail = () => { zip.close(); reject(new Error("El archivo XLSX no es compatible o excede los límites de seguridad.")); };
      zip.on("entry", (entry) => {
        entries += 1;
        uncompressed += entry.uncompressedSize;
        if (entries > 1000 || uncompressed > 50 * 1024 * 1024 || /(?:vbaProject\.bin|EncryptedPackage|EncryptionInfo)$/i.test(entry.fileName)) return fail();
        if (entry.fileName === "[Content_Types].xml") contentTypes = true;
        if (entry.fileName === "xl/workbook.xml") workbook = true;
        zip.readEntry();
      });
      zip.on("end", () => contentTypes && workbook ? resolve() : reject(new Error("El archivo no contiene un libro XLSX válido.")));
      zip.on("error", () => reject(new Error("El archivo XLSX no es legible.")));
      zip.readEntry();
    });
  });
}

function excelCell(cell: ExcelJS.Cell): { text: string; formula: boolean } {
  const value = cell.value;
  const formula = cell.type === ExcelJS.ValueType.Formula || !!(value && typeof value === "object" && ("formula" in value || "sharedFormula" in value));
  return { text: formula ? "" : cell.text ?? "", formula };
}

async function readXlsx(buffer: Buffer, fileName: string, requestedSheet?: string): Promise<ParsedVendorFile> {
  await checkXlsxArchive(buffer);
  const book = new ExcelJS.Workbook();
  try { await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]); }
  catch { throw new Error("El archivo XLSX está dañado o no es compatible."); }
  const sheets = book.worksheets.map((sheet) => sheet.name);
  const sheetName = requestedSheet || (sheets.includes("Directorio de Proveedores") ? "Directorio de Proveedores" : sheets[0]);
  const sheet = book.getWorksheet(sheetName);
  if (!sheet) throw new Error("La hoja seleccionada no existe en el archivo.");
  if (sheet.rowCount < 1 || sheet.rowCount - 1 > MAX_VENDOR_ROWS) throw new Error("La hoja no tiene encabezados o excede 10 000 filas.");
  const headerRow = sheet.getRow(1);
  const columnCount = Math.max(headerRow.cellCount, sheet.columnCount);
  if (columnCount > 100) throw new Error("El archivo tiene demasiadas columnas.");
  const headers = Array.from({ length: columnCount }, (_, i) => {
    const cell = excelCell(headerRow.getCell(i + 1));
    if (cell.formula) throw new Error("Los encabezados no pueden contener fórmulas.");
    return cell.text;
  });
  const rows: VendorFileRow[] = [];
  let blankRows = 0;
  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const row = sheet.getRow(index);
    const cells = Array.from({ length: Math.max(headers.length, row.cellCount) }, (_, i) => excelCell(row.getCell(i + 1)));
    if (blank(cells)) { blankRows += 1; continue; }
    rows.push({ sourceRow: index, cells });
  }
  return { fileName, format: "xlsx", sheetName, sheets, headers, rows, blankRows };
}

function csvDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0];
  const commas = (header.match(/,/g) ?? []).length;
  const semicolons = (header.match(/;/g) ?? []).length;
  if (commas === 0 && semicolons === 0) return ",";
  return semicolons > commas ? ";" : ",";
}

function readCsv(buffer: Buffer, fileName: string): ParsedVendorFile {
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { throw new Error("El CSV debe estar codificado en UTF-8."); }
  if (text.includes("\0")) throw new Error("El CSV contiene datos binarios.");
  let records: Array<{ record: string[]; info: { lines: number } }>;
  try { records = parseCsv(text, { bom: true, delimiter: csvDelimiter(text), info: true, relax_column_count: true, skip_empty_lines: false, max_record_size: 100_000 }) as unknown as typeof records; }
  catch { throw new Error("El CSV no es legible o contiene comillas sin cerrar."); }
  if (records.length < 1 || records.length - 1 > MAX_VENDOR_ROWS) throw new Error("El CSV no tiene encabezados o excede 10 000 filas.");
  const width = Math.max(...records.map((item) => item.record.length));
  if (width > 100) throw new Error("El archivo tiene demasiadas columnas.");
  const headers = Array.from({ length: width }, (_, index) => records[0].record[index] ?? "");
  const rows: VendorFileRow[] = [];
  let blankRows = 0;
  let previousEndLine = records[0].info.lines;
  for (const item of records.slice(1)) {
    const sourceRow = previousEndLine + 1;
    previousEndLine = item.info.lines;
    const cells = item.record.map((value) => ({ text: value, formula: false }));
    if (blank(cells)) { blankRows += 1; continue; }
    rows.push({ sourceRow, cells });
  }
  return { fileName, format: "csv", sheetName: null, sheets: [], headers, rows, blankRows };
}

export async function readVendorFile(file: File, requestedSheet?: string): Promise<ParsedVendorFile> {
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_VENDOR_FILE_BYTES)
    throw new Error("Selecciona un archivo de hasta 4 MB.");
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (extension !== "xlsx" && extension !== "csv") throw new Error("Formato no compatible. Usa .xlsx o .csv.");
  const allowedMime = extension === "xlsx"
    ? ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream", ""]
    : ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream", ""];
  if (!allowedMime.includes(file.type)) throw new Error("El tipo de archivo no coincide con su extensión.");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (extension === "xlsx") {
    if (buffer.subarray(0, 4).toString("hex") !== "504b0304") throw new Error("El XLSX no tiene una estructura válida.");
    return readXlsx(buffer, file.name, requestedSheet);
  }
  if (buffer.subarray(0, 2).toString("hex") === "504b") throw new Error("Un archivo ZIP no es un CSV.");
  return readCsv(buffer, file.name);
}

export function mapVendorRows(file: ParsedVendorFile, mapping: VendorImportMapping): MappedVendorRow[] {
  validateMapping(file.headers, mapping);
  return file.rows.map((row) => {
    const values: Record<string, string> = {};
    const errors: string[] = [];
    for (const field of vendorImportFields) {
      const index = mapping[field.key];
      if (index === undefined) continue;
      const cell = row.cells[index];
      if (cell?.formula) { errors.push("La fila contiene una fórmula en una columna asignada."); continue; }
      values[field.key] = cell?.text ?? "";
    }
    if (errors.length) return { sourceRow: row.sourceRow, data: null, errors, warnings: [] };
    try {
      const data = parseVendorInput(values);
      const warnings = data.website && !safeVendorWebsiteUrl(data.website) ? ["Sitio web conservado como texto; no es un enlace verificado."] : [];
      return { sourceRow: row.sourceRow, data, errors: [], warnings };
    } catch {
      return { sourceRow: row.sourceRow, data: null, errors: [!values.name?.trim() ? "Proveedor vacío." : "Datos no válidos; revisa el correo y la longitud de los campos."], warnings: [] };
    }
  });
}
