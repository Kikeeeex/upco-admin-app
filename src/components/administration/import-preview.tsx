"use client";

import { useState } from "react";

type PreviewRow = Record<string, string>;
type Preview = { fileName: string; rows: PreviewRow[]; total: number; columns: string[]; documentTemplate: boolean; invalidRows: number; rowProblems: string[] };
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;
const DISPLAY_ROWS = 10;
const DOCUMENT_COLUMNS = ["RIF proveedor", "Tipo", "Fecha emisión", "Pago o abono", "Período IVA", "Quincena IVA", "Número documento", "Número control", "Factura afectada", "Exento", "Base 16%", "Base 8%", "Retención IVA %", "Monto IVA retenido", "Comprobante IVA", "Concepto ISLR", "Base ISLR", "Tasa ISLR %", "Monto ISLR", "Comprobante ISLR", "Descripción", "Cuenta código", "CECO reparto", "Aplica IGTF", "Base IGTF", "Base gravable ISLR", "Sustraendo ISLR"];
const REQUIRED_DOCUMENT_FIELDS = ["RIF proveedor", "Tipo", "Fecha emisión", "Pago o abono", "Número documento", "Descripción", "Cuenta código", "CECO reparto"];

function validateDocumentRows(columns: string[], rows: PreviewRow[]) {
  const documentTemplate = DOCUMENT_COLUMNS.every((column, index) => columns[index] === column) && columns.length === DOCUMENT_COLUMNS.length;
  if (!documentTemplate) return { documentTemplate: false, invalidRows: 0, rowProblems: [] as string[] };
  const problems: string[] = [];
  rows.forEach((row, index) => {
    const missing = REQUIRED_DOCUMENT_FIELDS.filter((field) => !row[field]?.trim());
    if (missing.length) problems.push(`Fila ${index + 2}: faltan ${missing.join(", ")}.`);
    const type = row["Tipo"]?.trim().toLowerCase();
    if (type && !["factura", "nota_credito", "nota_debito"].includes(type)) problems.push(`Fila ${index + 2}: tipo de documento no reconocido.`);
    const half = row["Quincena IVA"]?.trim();
    if (half && !["1", "2"].includes(half)) problems.push(`Fila ${index + 2}: quincena IVA debe ser 1 o 2.`);
  });
  return { documentTemplate: true, invalidRows: new Set(problems.map((problem) => Number(problem.match(/^Fila (\d+)/)?.[1])).filter(Number.isFinite)).size, rowProblems: problems.slice(0, 10) };
}

function parseDelimited(text: string): { columns: string[]; rows: PreviewRow[]; documentTemplate: boolean; invalidRows: number; rowProblems: string[] } {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", ",", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const cells: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim() !== "")) cells.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some((value) => value.trim() !== "")) cells.push(row); }
  if (quoted) throw new Error("El CSV contiene una celda entrecomillada sin cierre.");
  if (cells.length < 2) throw new Error("El archivo debe incluir encabezados y al menos una fila.");
  const columns = cells[0].map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim());
  if (!columns[0] || new Set(columns).size !== columns.length) throw new Error("Los encabezados están vacíos o repetidos.");
  const rows = cells.slice(1).map((values) => Object.fromEntries(columns.map((column, index) => [column, (values[index] ?? "").trim()])));
  return { columns, rows, ...validateDocumentRows(columns, rows) };
}

function parseJson(text: string): { columns: string[]; rows: PreviewRow[]; documentTemplate: boolean; invalidRows: number; rowProblems: string[] } {
  const parsed: unknown = JSON.parse(text);
  const values = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && "data" in parsed && Array.isArray((parsed as { data: unknown }).data) ? (parsed as { data: unknown[] }).data : null;
  if (!values || values.length === 0 || values.some((value) => !value || typeof value !== "object" || Array.isArray(value))) {
    throw new Error("El JSON debe ser una lista de objetos (o un objeto con una propiedad data que contenga esa lista).");
  }
  const columns = [...new Set(values.flatMap((value) => Object.keys(value as Record<string, unknown>)))];
  const rows = values.map((value) => Object.fromEntries(columns.map((column) => {
    const item = (value as Record<string, unknown>)[column];
    return [column, item == null ? "" : typeof item === "object" ? JSON.stringify(item) : String(item)];
  })));
  return { columns, rows, documentTemplate: false, invalidRows: 0, rowProblems: [] };
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const item = value as { text?: string; richText?: { text: string }[]; result?: unknown; formula?: string };
    if (item.text) return item.text;
    if (item.richText) return item.richText.map((part) => part.text).join("");
    if (item.formula) return cellText(item.result);
    return JSON.stringify(value);
  }
  return String(value);
}

async function parseXlsx(file: File) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet("Documentos") ?? workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 1) throw new Error("El libro no contiene una hoja con encabezados.");
  const columns = (sheet.getRow(1).values as unknown[]).slice(1).map(cellText).map((value) => value.trim());
  const rows: PreviewRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as unknown[]).slice(1);
    const record = Object.fromEntries(columns.map((column, index) => [column, cellText(values[index]).trim()]));
    if (Object.values(record).some(Boolean)) rows.push(record);
  });
  if (!rows.length) throw new Error("La plantilla no contiene filas con documentos para revisar.");
  return { columns, rows, ...validateDocumentRows(columns, rows) };
}

export function ImportPreview() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function readFile(file?: File) {
    setPreview(null); setError("");
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError("El archivo supera el límite de 5 MB."); return; }
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "csv" && extension !== "json" && extension !== "xlsx") {
      setError("Selecciona un archivo CSV, JSON o XLSX."); return;
    }
    setBusy(true);
    try {
      const content = extension === "xlsx" ? null : await file.text();
      const result = extension === "xlsx" ? await parseXlsx(file) : extension === "json" ? parseJson(content ?? "") : parseDelimited(content ?? "");
      if (extension === "xlsx" && !result.documentTemplate) throw new Error("Las columnas no coinciden con la plantilla de importación histórica de UPCO.");
      if (result.rows.length > MAX_ROWS) throw new Error(`El archivo contiene más de ${MAX_ROWS} filas; divídelo antes de previsualizarlo.`);
      setPreview({ fileName: file.name, ...result, total: result.rows.length });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el archivo.");
    } finally { setBusy(false); }
  }
  const rifColumn = preview?.columns.find((column) => /^(rif|tax_identifier|taxidentifier)$/i.test(column));
  const rifs = rifColumn ? preview?.rows.map((row) => row[rifColumn].toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean) ?? [] : [];
  const duplicateCount = rifs.length - new Set(rifs).size;
  const missingRifCount = rifColumn ? (preview?.rows.filter((row) => !row[rifColumn].trim()).length ?? 0) : 0;

  return <section className="work-card">
    <h2>Vista previa local</h2>
    <p className="muted-note">El archivo se procesa en este navegador y no se envía al servidor. Se elimina de la vista al cambiarlo o cerrar la página. La vista previa no valida el contenido fiscal contra la autoridad.</p>
    <div className="field import-file-field"><label htmlFor="administration-import-file">Archivo CSV, JSON o XLSX</label><input id="administration-import-file" type="file" accept=".csv,.json,.xlsx,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void readFile(event.target.files?.[0])} /></div>
    {busy && <p role="status">Leyendo archivo local…</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {preview && <div className="import-preview-result" aria-live="polite">
      <h3>{preview.fileName}</h3>
      <p>{preview.total} filas · {preview.columns.length} columnas · máximo de {DISPLAY_ROWS} filas visibles</p>
      {preview.documentTemplate && <><p className="badge">Plantilla de importación histórica reconocida · revisión estructural local</p><p>{preview.invalidRows} filas con observaciones estructurales.</p>{preview.rowProblems.length > 0 && <ul>{preview.rowProblems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}</>}
      {rifColumn && <ul><li>RIF ausentes: {missingRifCount}</li><li>RIF duplicados en el archivo: {duplicateCount}</li><li>Filas con RIF listo para comparar: {rifs.length}</li></ul>}
      {!rifColumn && <p className="muted-note">No se detectó una columna RIF; la revisión de duplicados fiscales no está disponible.</p>}
      <div className="table-scroll"><table><thead><tr>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{preview.rows.slice(0, DISPLAY_ROWS).map((row, index) => <tr key={index}>{preview.columns.map((column) => <td key={column}>{row[column]}</td>)}</tr>)}</tbody></table></div>
      <p className="administration-lock-note">La validación solo revisa estructura y campos básicos de la plantilla. Confirmar importación está bloqueado; no se crea ni actualiza ningún proveedor o documento desde esta pantalla.</p>
    </div>}
  </section>;
}
