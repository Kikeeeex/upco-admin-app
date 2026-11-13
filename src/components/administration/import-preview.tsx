"use client";

import { useState } from "react";
import { importHistoricalDocumentsAction, validateHistoricalImportAction } from "@/features/administration/imports/actions";
import type { HistoricalImportValidation } from "@/features/administration/imports/validation";

type PreviewRow = Record<string, string>;
type Preview = { fileName: string; rows: PreviewRow[]; total: number; columns: string[]; documentTemplate: boolean; invalidRows: number; rowProblems: string[] };
const MAX_FILE_BYTES = 4 * 1024 * 1024;
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

export function ImportPreview({ canImport = false }: { canImport?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<HistoricalImportValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function readFile(file?: File) {
    setPreview(null); setError(""); setValidation(null); setSelectedFile(file ?? null); setAcknowledgeWarnings(false);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError("El archivo supera el límite de 4 MB."); return; }
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
  async function validateOnServer() {
    if (!selectedFile) return;
    setValidation(null); setAcknowledgeWarnings(false); setValidating(true);
    try {
      const form = new FormData();
      form.set("file", selectedFile);
      setValidation(await validateHistoricalImportAction(form));
    } catch {
      setValidation({ kind: "error", message: "No se pudo completar la validación del servidor. Vuelve a intentarlo." });
    } finally { setValidating(false); }
  }
  async function importOnServer() {
    if (!selectedFile) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.set("file", selectedFile);
      if (acknowledgeWarnings) form.set("acknowledgeWarnings", "on");
      setValidation(await importHistoricalDocumentsAction(form));
    } catch {
      setValidation({ kind: "error", message: "No se pudo completar la importación. Actualiza la validación y vuelve a intentarlo." });
    } finally { setImporting(false); }
  }
  const rifColumn = preview?.columns.find((column) => /^(rif|tax_identifier|taxidentifier)$/i.test(column));
  const rifs = rifColumn ? preview?.rows.map((row) => row[rifColumn].toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean) ?? [] : [];
  const duplicateCount = rifs.length - new Set(rifs).size;
  const missingRifCount = rifColumn ? (preview?.rows.filter((row) => !row[rifColumn].trim()).length ?? 0) : 0;

  return <section className="work-card">
    <div className="administration-panel-heading"><div><h2>Importar documentos históricos</h2><p>Plantilla UPCO y validación de archivos históricos.</p></div><a className="quiet-button" href="/UPCO_Plantilla_Importar_Documentos.xlsx" download>Descargar plantilla</a></div>
    <h3>Vista previa local</h3>
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
      {preview.documentTemplate && selectedFile && !selectedFile.name.toLowerCase().endsWith(".json") && <div className="import-server-validation">
        <button className="quiet-button" type="button" disabled={busy || validating || importing || preview.invalidRows > 0 || Boolean(validation?.imported)} onClick={() => void validateOnServer()}>
          {validating ? "Validando en servidor…" : "Validar contra el servidor"}
        </button>
        {preview.invalidRows > 0 && <p className="muted-note">Corrige primero las observaciones estructurales de la vista previa.</p>}
        {validation && <div className={validation.kind === "error" || (validation.blocked ?? 0) > 0 ? "administration-lock-note" : "badge"} role={validation.kind === "error" || (validation.blocked ?? 0) > 0 ? "alert" : "status"}>
          <strong>{validation.message}</strong>
          {validation.kind === "validated" && <p>{validation.ready} listas · {validation.blocked} bloqueadas · {validation.warnings} observaciones.</p>}
          {validation.details && validation.details.length > 0 && <ul>{validation.details.map((detail) => <li key={detail.row}>
            <strong>Fila {detail.row} · {detail.document}:</strong> {[...detail.issues, ...detail.warnings.map((warning) => `Observación: ${warning}`)].join(" ")}
          </li>)}</ul>}
          {!!validation.moreDetails && <p>Hay {validation.moreDetails} filas adicionales con detalles no mostrados.</p>}
        </div>}
        {canImport && validation?.kind === "validated" && !validation.imported && validation.blocked === 0 && (validation.warnings ?? 0) > 0 && <label className="field import-warning-confirmation">
          <span><input type="checkbox" checked={acknowledgeWarnings} onChange={(event) => setAcknowledgeWarnings(event.target.checked)} /> Confirmo que revisé las observaciones y autorizo continuar con este lote.</span>
        </label>}
        {canImport && validation?.kind === "validated" && !validation.imported && validation.blocked === 0 && <button className="primary-button" type="button" disabled={validating || importing || ((validation.warnings ?? 0) > 0 && !acknowledgeWarnings)} onClick={() => void importOnServer()}>
          {importing ? "Importando lote…" : `Confirmar e importar ${validation.ready ?? 0} documentos`}
        </button>}
        {canImport && <p className="administration-lock-note">{validation?.imported ? "Se conservaron los números originales de comprobante; la importación quedó auditada y no generó nuevos comprobantes. Las secuencias quedaron avanzadas al mayor número importado." : "Al confirmar, el servidor vuelve a validar el archivo. Un error en cualquier fila revierte el lote completo; no se generan comprobantes ni correlativos nuevos."}</p>}
        {!canImport && validation?.kind === "validated" && <p className="administration-lock-note">La validación terminó. Tu permiso no incluye escritura histórica; solicita a una persona administradora que confirme el lote.</p>}
      </div>}
      {!preview.documentTemplate && <p className="administration-lock-note">El archivo no coincide con la plantilla histórica de documentos; esta pantalla no creará ni actualizará registros.</p>}
    </div>}
  </section>;
}
