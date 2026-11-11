import { inflateRawSync } from "node:zlib";
import { fail } from "./core";
import { readFileSync } from "node:fs";
import path from "node:path";

export const IMPORT_HEADERS = [
  "RIF proveedor", "Tipo", "Fecha emisión", "Pago o abono", "Período IVA", "Quincena IVA",
  "Número documento", "Número control", "Factura afectada", "Exento", "Base 16%", "Base 8%",
  "Retención IVA %", "Monto IVA retenido", "Comprobante IVA", "Concepto ISLR", "Base ISLR", "Tasa ISLR %",
  "Monto ISLR", "Comprobante ISLR", "Descripción", "Cuenta código", "CECO reparto", "Aplica IGTF", "Base IGTF",
  "Base gravable ISLR", "Sustraendo ISLR",
] as const;

export type ImportRawRow = { row: number; cells: string[] };
const unxml = (value: string) => value.replace(/&#x([0-9a-f]+);|&#([0-9]+);|&amp;|&lt;|&gt;|&quot;|&apos;/gi, match => {
  if (match.startsWith("&#x")) return String.fromCodePoint(parseInt(match.slice(3, -1), 16));
  if (match.startsWith("&#")) return String.fromCodePoint(parseInt(match.slice(2, -1), 10));
  return ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" } as Record<string, string>)[match.toLowerCase()] ?? match;
});

export function makeImportTemplateXlsx(): Uint8Array {
  return readFileSync(path.join(process.cwd(), "public", "UPCO_Plantilla_Importar_Documentos.xlsx"));
}

function columnIndex(ref: string) {
  let result = 0;
  for (const char of ref.toUpperCase()) result = result * 26 + char.charCodeAt(0) - 64;
  return result - 1;
}
function parseCsv(source: string): string[][] {
  const first = source.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];
  const delimiter = [";", ",", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) { if (char === '"' && source[i + 1] === '"') { field += '"'; i++; } else if (char === '"') quoted = false; else field += char; }
    else if (char === '"' && !field) quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\r" || char === "\n") { if (char === "\r" && source[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (quoted) fail("CSV con comillas sin cerrar");
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function zipEntries(buffer: Buffer): Map<string, Buffer> {
  const endStart = Math.max(0, buffer.length - 65557);
  let end = -1;
  for (let at = buffer.length - 22; at >= endStart; at--) if (buffer.readUInt32LE(at) === 0x06054b50) { end = at; break; }
  if (end < 0) fail("El XLSX no es un archivo ZIP válido");
  const count = buffer.readUInt16LE(end + 10), offset = buffer.readUInt32LE(end + 16);
  if (count > 200 || offset >= buffer.length) fail("El XLSX no tiene una estructura válida");
  const files = new Map<string, Buffer>(); let at = offset;
  for (let index = 0; index < count; index++) {
    if (at + 46 > buffer.length || buffer.readUInt32LE(at) !== 0x02014b50) fail("Directorio XLSX inválido");
    const method = buffer.readUInt16LE(at + 10), compressed = buffer.readUInt32LE(at + 20), uncompressed = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28), extra = buffer.readUInt16LE(at + 30), comment = buffer.readUInt16LE(at + 32), local = buffer.readUInt32LE(at + 42);
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    if (uncompressed > 12_000_000 || local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) fail("XLSX demasiado grande o dañado");
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressed > buffer.length) fail("XLSX incompleto");
    if (name === "xl/worksheets/sheet1.xml" || name === "xl/sharedStrings.xml") {
      const content = buffer.subarray(start, start + compressed);
      const decoded = method === 0 ? content : method === 8 ? inflateRawSync(content, { maxOutputLength: 12_000_000 }) : fail("Compresión XLSX no admitida");
      if (decoded.length !== uncompressed) fail("XLSX incompleto");
      files.set(name, decoded);
    }
    at += 46 + nameLength + extra + comment;
  }
  return files;
}
function excelDate(serial: string) {
  const days = Number(serial);
  if (!Number.isFinite(days) || days < 1 || days > 200000) return serial;
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(days) * 86400000).toISOString().slice(0, 10);
}
function parseXlsx(buffer: Buffer): string[][] {
  const files = zipEntries(buffer);
  const sheet = files.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  if (!sheet) fail("El XLSX no contiene la hoja Documentos");
  const shared: string[] = [];
  const sharedXml = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  for (const match of sharedXml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)) shared.push([...match[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(x => unxml(x[1])).join(""));
  const rows: string[][] = [];
  for (const match of sheet.matchAll(/<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const number = Number(match[1].match(/\br="(\d+)"/)?.[1]);
    if (!Number.isInteger(number) || number < 1 || number > 5001) fail("Fila XLSX inválida");
    const cells: string[] = [];
    // Empty styled cells are serialized as <c .../>. Do not let a match start
    // there and consume the next nonempty cell as its value.
    for (const item of match[2].matchAll(/<(?:\w+:)?c\b([^>]*?)(?<!\/)>([\s\S]*?)<\/(?:\w+:)?c>/g)) {
      if (/<(?:\w+:)?f\b/.test(item[2])) fail("La plantilla contiene fórmulas; pegue valores antes de importar");
      const ref = item[1].match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;
      const index = columnIndex(ref);
      if (index > 100) fail("Demasiadas columnas en el XLSX");
      const kind = item[1].match(/\bt="([^"]+)"/)?.[1];
      const value = kind === "inlineStr" ? [...item[2].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(x => unxml(x[1])).join("") : unxml(item[2].match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? "");
      cells[index] = kind === "s" ? shared[Number(value)] ?? "" : [2, 3].includes(index) && /^\d+(?:\.\d+)?$/.test(value) ? excelDate(value) : value;
    }
    rows[number - 1] = cells;
  }
  return rows;
}

export function readImportSpreadsheet(data: Uint8Array, name: string): ImportRawRow[] {
  if (data.length > 5_000_000) fail("El archivo supera 5 MB");
  const rows = name.toLowerCase().endsWith(".xlsx") ? parseXlsx(Buffer.from(data))
    : name.toLowerCase().endsWith(".csv") ? parseCsv(new TextDecoder().decode(data))
      : fail("Seleccione un archivo .xlsx o .csv");
  const headers = rows[0]?.map(value => value?.trim().replace(/^\uFEFF/, "")) ?? [];
  if (IMPORT_HEADERS.some((expected, index) => headers[index] !== expected)) fail("La primera fila no coincide con la plantilla de importación UPCO");
  const result = rows.slice(1).map((cells, index) => ({ row: index + 2, cells: IMPORT_HEADERS.map((_, column) => String(cells?.[column] ?? "").trim()) }))
    .filter(item => item.cells.some(Boolean));
  if (result.length > 2000) fail("Importe máximo 2.000 documentos por archivo");
  return result;
}
