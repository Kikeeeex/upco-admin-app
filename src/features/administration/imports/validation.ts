import "server-only";

import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import type { getAccessContext } from "@/features/auth/access";
import { calculateDocument, fiscalHalf, normalizeVendor, validateDate } from "@/features/administration/documents/tax-engine";
import { readApprovedTaxSettings } from "@/features/administration/documents/tax-settings";
import { createAdministrationServiceClient } from "@/features/administration/documents/service-client";

const HEADERS = [
  "RIF proveedor", "Tipo", "Fecha emisión", "Pago o abono", "Período IVA", "Quincena IVA",
  "Número documento", "Número control", "Factura afectada", "Exento", "Base 16%", "Base 8%",
  "Retención IVA %", "Monto IVA retenido", "Comprobante IVA", "Concepto ISLR", "Base ISLR", "Tasa ISLR %",
  "Monto ISLR", "Comprobante ISLR", "Descripción", "Cuenta código", "CECO reparto", "Aplica IGTF", "Base IGTF",
  "Base gravable ISLR", "Sustraendo ISLR",
] as const;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 2000;
const MAX_DETAILS = 200;

type Access = Extract<Awaited<ReturnType<typeof getAccessContext>>, { kind: "allowed" }>;
type SourceRow = { row: number; cells: string[]; parseIssues: string[] };
type RowResult = { row: number; document: string; issues: string[]; warnings: string[]; invoiceKey?: string; isInvoice: boolean };
export type HistoricalImportValidation = {
  kind: "validated" | "error";
  message: string;
  total?: number;
  ready?: number;
  blocked?: number;
  warnings?: number;
  imported?: number;
  requiresWarningAcknowledgement?: boolean;
  details?: { row: number; document: string; issues: string[]; warnings: string[] }[];
  moreDetails?: number;
};
type PreparedHistoricalDocument = Record<string, unknown> & { document_type: string; source_row: number };
type HistoricalImportRun = { report: HistoricalImportValidation; preparedDocuments: PreparedHistoricalDocument[]; settingsSnapshot?: Record<string, unknown> };

function fail(message: string): never { throw new Error(message); }
function normalized(value: string) { return value.trim().toUpperCase(); }
function normalizedRif(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }

function parseAmount(value: string, label: string, required = false): number {
  const source = value.trim();
  if (!source) { if (required) fail(`${label} obligatorio`); return 0; }
  if (/^\d{1,3}\.\d{3}$/.test(source)) fail(`${label}: formato ambiguo; use 1234,00 o 1234.00`);
  let normalizedAmount: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(source)) normalizedAmount = source.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(?:[.,]\d{1,2})?$/.test(source)) normalizedAmount = source.replace(",", ".");
  else fail(`${label}: use un monto no negativo con máximo dos decimales`);
  const amount = Number(normalizedAmount);
  if (!Number.isFinite(amount) || amount > 90_000_000_000) fail(`${label}: monto fuera de rango`);
  return amount;
}

function parsePercent(value: string, label: string, required = false): number {
  const result = parseAmount(value, label, required);
  if (result > 100) fail(`${label}: porcentaje inválido`);
  return result;
}

function parseBoolean(value: string, label: string): boolean {
  const normalizedValue = value.trim().toLocaleLowerCase("es");
  if (["sí", "si", "1"].includes(normalizedValue)) return true;
  if (["no", "0"].includes(normalizedValue)) return false;
  fail(`${label}: indique Sí/No o 1/0`);
}

function detectDelimiter(line: string): string {
  const counts = [";", ",", "\t"].map(delimiter => {
    let quoted = false, count = 0;
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] === '"') {
        if (quoted && line[i + 1] === '"') i += 1;
        else quoted = !quoted;
      } else if (!quoted && line[i] === delimiter) count += 1;
    }
    return { delimiter, count };
  });
  return counts.sort((a, b) => b.count - a.count)[0].delimiter;
}

function excelDate(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10);
}

function cellText(value: ExcelJS.CellValue, column: number): { text: string; formula: boolean } {
  if (value == null) return { text: "", formula: false };
  if (value instanceof Date) return { text: value.toISOString().slice(0, 10), formula: false };
  if (typeof value === "number") return { text: column === 2 || column === 3 ? excelDate(value) : String(value), formula: false };
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) return { text: "", formula: true };
    if ("text" in value && typeof value.text === "string") return { text: value.text, formula: false };
    if ("richText" in value && Array.isArray(value.richText)) return { text: value.richText.map(part => part.text).join(""), formula: false };
    if ("result" in value) return { text: String(value.result ?? ""), formula: false };
    return { text: String(value), formula: false };
  }
  return { text: String(value), formula: false };
}

async function readRows(file: File): Promise<SourceRow[]> {
  if (file.size === 0 || file.size > MAX_FILE_BYTES) fail("El archivo debe tener contenido y pesar como máximo 4 MB.");
  const extension = file.name.toLowerCase().split(".").pop();
  const data = new Uint8Array(await file.arrayBuffer());
  let rows: SourceRow[];
  if (extension === "csv") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data).replace(/^\uFEFF/, "");
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const parsed = parseCsv(text, { bom: true, delimiter: detectDelimiter(firstLine), skip_empty_lines: true, relax_column_count: true, record_delimiter: ["\r\n", "\n", "\r"] }) as string[][];
    const headers = (parsed[0] ?? []).map(value => String(value ?? "").trim());
    if (headers.length !== HEADERS.length || HEADERS.some((header, index) => headers[index] !== header)) fail("Los encabezados no coinciden con la plantilla histórica de UPCO.");
    rows = parsed.slice(1).map((values, index) => {
      const cells = HEADERS.map((_, column) => String(values[column] ?? "").trim());
      const issues = values.length !== HEADERS.length ? ["La fila no tiene las 27 columnas esperadas."] : [];
      return { row: index + 2, cells, parseIssues: issues };
    }).filter(item => item.cells.some(Boolean) || item.parseIssues.length > 0);
  } else if (extension === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(data) as never);
    const sheet = workbook.getWorksheet("Documentos") ?? workbook.worksheets[0];
    if (!sheet) fail("El libro no contiene la hoja Documentos.");
    const headers = HEADERS.map((_, index) => cellText(sheet.getRow(1).getCell(index + 1).value, index).text.trim());
    if (HEADERS.some((header, index) => headers[index] !== header) || sheet.getRow(1).cellCount !== HEADERS.length) fail("Los encabezados no coinciden con la plantilla histórica de UPCO.");
    if (sheet.rowCount > MAX_ROWS + 1) fail(`El archivo supera el máximo de ${MAX_ROWS} documentos.`);
    rows = [];
    sheet.eachRow((excelRow, rowNumber) => {
      if (rowNumber === 1) return;
      const cells: string[] = [];
      const parseIssues: string[] = [];
      for (let column = 0; column < HEADERS.length; column += 1) {
        const result = cellText(excelRow.getCell(column + 1).value, column);
        cells.push(result.text.trim());
        if (result.formula && !parseIssues.includes("La fila contiene fórmulas; conviértalas a valores antes de validar.")) parseIssues.push("La fila contiene fórmulas; conviértalas a valores antes de validar.");
      }
      if (cells.some(Boolean) || parseIssues.length > 0) rows.push({ row: rowNumber, cells, parseIssues });
    });
  } else fail("Seleccione un archivo CSV o XLSX con la plantilla histórica de UPCO.");
  if (!rows.length) fail("El archivo no contiene documentos para validar.");
  if (rows.length > MAX_ROWS) fail(`El archivo supera el máximo de ${MAX_ROWS} documentos.`);
  return rows;
}

function supplierInput(row: Record<string, unknown>) {
  const taxpayer = String(row.taxpayer_type ?? "ordinario").toLowerCase();
  return normalizeVendor({
    rif: row.tax_identifier, name: row.legal_name, address: row.tax_address,
    taxpayerType: taxpayer.includes("formal") ? "formal" : taxpayer.includes("especial") ? "especial" : "ordinario",
    personType: row.person_type === "legal" ? "juridica" : "natural",
    residency: row.residency ?? undefined,
    ivaRetentionRate: row.iva_retention_rate,
    active: row.active,
  });
}

function certificateNumber(value: string, period: string, label: string): string {
  const number = value.trim();
  if (!number) return "";
  if (!/^\d{14}$/.test(number) || !number.startsWith(period.replace("-", "")) || Number(number.slice(6)) < 1) {
    fail(`${label}: debe tener formato AAAAMM + ocho dígitos para ${period}.`);
  }
  return number;
}

function allocations(source: string, settings: ReturnType<typeof readApprovedTaxSettings>) {
  if (!source.trim()) fail("CECO reparto obligatorio; use CODIGO:PORCENTAJE;CODIGO:PORCENTAJE.");
  const result = source.split(";").map(part => {
    const match = /^\s*([^:;]+)\s*:\s*([^:;]+)\s*$/.exec(part);
    if (!match) fail("CECO reparto debe usar CODIGO:PORCENTAJE;CODIGO:PORCENTAJE.");
    const ceco = settings.cecos.find(item => item.active && normalized(item.code) === normalized(match[1]));
    if (!ceco) fail(`CECO ${match[1].trim()} no existe o está inactivo.`);
    return { cecoId: ceco.id, percentage: parsePercent(match[2], "Porcentaje CECO", true) };
  });
  if (new Set(result.map(item => item.cecoId)).size !== result.length) fail("No repita CECO en una distribución.");
  if (result.some(item => item.percentage <= 0) || Math.round(result.reduce((sum, item) => sum + item.percentage, 0) * 100) !== 10000) fail("La distribución CECO debe sumar exactamente 100 %.");
  return result;
}

async function existingDocuments(access: Access) {
  const documents: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await access.supabase.from("administration_documents")
      .select("id, fiscal_vendor_id, document_type, invoice_number, iva_certificate_number, islr_certificate_number, status")
      .eq("organization_id", access.organizationId).order("id").range(from, from + 999);
    if (error) fail("No se pudieron consultar los documentos existentes para revisar duplicados.");
    documents.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return documents;
}

async function prepareHistoricalImportFile(file: File, access: Access): Promise<HistoricalImportRun> {
  let sourceRows: SourceRow[];
  try { sourceRows = await readRows(file); }
  catch (error) { return { report: { kind: "error", message: error instanceof Error ? error.message : "No se pudo leer la plantilla." }, preparedDocuments: [] }; }

  const [{ data: active, error: settingsError }, { data: vendors, error: vendorsError }, documents] = await Promise.all([
    access.supabase.from("fiscal_settings_activations").select("id, version_no, config_snapshot")
      .eq("organization_id", access.organizationId).is("ended_at", null).maybeSingle(),
    access.supabase.from("fiscal_vendors").select("id, legal_name, tax_identifier, tax_address, taxpayer_type, person_type, residency, iva_retention_rate, active, review_state")
      .eq("organization_id", access.organizationId),
    existingDocuments(access),
  ]);
  if (settingsError || vendorsError) return { report: { kind: "error", message: "No se pudieron leer la configuración fiscal activa o el registro de proveedores." }, preparedDocuments: [] };
  if (!active) return { report: { kind: "error", message: "No hay configuración fiscal activa. El archivo se leyó, pero no puede completarse su validación fiscal en servidor." }, preparedDocuments: [] };

  let settings: ReturnType<typeof readApprovedTaxSettings>;
  try { settings = readApprovedTaxSettings(active.config_snapshot); }
  catch { return { report: { kind: "error", message: "La configuración fiscal activa no supera la validación del módulo; no se validó ningún documento." }, preparedDocuments: [] }; }
  const settingsSnapshot = { activationId: active.id, version: active.version_no, config: active.config_snapshot };
  const vendorByRif = new Map((vendors ?? []).map(row => [normalizedRif(row.tax_identifier), row] as const));
  const existingKeys = new Set(documents.map(row => `${row.fiscal_vendor_id}|${row.document_type}|${normalized(String(row.invoice_number ?? ""))}`));
  const existingIva = new Set(documents.map(row => row.iva_certificate_number).filter((value): value is string => typeof value === "string" && Boolean(value)));
  const existingIslr = new Set(documents.map(row => row.islr_certificate_number).filter((value): value is string => typeof value === "string" && Boolean(value)));
  const batchDocKeys = new Map<string, number[]>();
  const batchIva = new Map<string, number[]>();
  const batchIslr = new Map<string, number[]>();
  const results: RowResult[] = [];
  const preparedByRow = new Map<number, PreparedHistoricalDocument>();

  for (const source of sourceRows) {
    const c = source.cells;
    const result: RowResult = { row: source.row, document: c[6] || "(sin número)", issues: [...source.parseIssues], warnings: [], isInvoice: c[1] === "factura" };
    results.push(result);
    const issue = (message: string) => result.issues.push(message);
    const warn = (message: string) => result.warnings.push(message);
    if (c.some(value => /^[=+@]/.test(value.trim()))) issue("La fila contiene fórmula o contenido que comienza por =, + o @.");

    const rif = normalizedRif(c[0]);
    let vendorRow: Record<string, unknown> | undefined;
    let vendor: ReturnType<typeof normalizeVendor> | undefined;
    if (!/^[VEJPG]\d{9}$/.test(rif)) issue("RIF proveedor inválido.");
    else {
      vendorRow = vendorByRif.get(rif);
      if (!vendorRow) issue(`El proveedor ${rif} no está registrado.`);
      else if (!vendorRow.active || vendorRow.review_state !== "confirmed") issue(`El proveedor ${rif} no está activo y confirmado.`);
      else {
        try { vendor = supplierInput(vendorRow); }
        catch { issue(`La ficha fiscal del proveedor ${rif} tiene datos incompatibles.`); }
      }
    }

    const docType = c[1] === "factura" ? "invoice" : c[1] === "nota_credito" ? "credit_note" : c[1] === "nota_debito" ? "debit_note" : null;
    if (!docType) issue("Tipo debe ser factura, nota_credito o nota_debito.");
    const number = c[6].trim();
    const control = c[7].trim();
    if (!number || number.length > 80 || /[\t\r\n]/.test(number)) issue("Número documento obligatorio o inválido.");
    if (!control || control.length > 80 || /[\t\r\n]/.test(control)) issue("Número control obligatorio o inválido.");

    try {
      const issuedAt = validateDate(c[2], "Fecha emisión");
      const eventAt = validateDate(c[3], "Pago o abono");
      const normalHalf = fiscalHalf(eventAt);
      const period = c[4] || normalHalf.period;
      const half = c[5] ? Number(c[5]) : normalHalf.half;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || ![1, 2].includes(half)) issue("Período IVA o quincena inválidos.");
      if (period !== normalHalf.period || half !== normalHalf.half) warn("El período IVA/quincena difiere de la fecha de pago; revisar soporte del diferimiento.");

      const docKey = vendorRow && docType && number ? `${vendorRow.id}|${docType}|${normalized(number)}` : "";
      if (docKey) {
        result.invoiceKey = `${vendorRow!.id}|${normalized(number)}`;
        batchDocKeys.set(docKey, [...(batchDocKeys.get(docKey) ?? []), source.row]);
        if (existingKeys.has(docKey)) issue("El documento ya existe para ese proveedor, tipo y número.");
      }

      const account = settings.paymentAccounts.find(value => value.active && normalized(value.code) === normalized(c[21]));
      if (!account) issue(`La cuenta ${c[21] || "(vacía)"} no existe o está inactiva.`);
      let ceco = [] as ReturnType<typeof allocations>;
      try { ceco = allocations(c[22], settings); }
      catch (error) { issue(error instanceof Error ? error.message : "Distribución CECO inválida."); }

      const igtfApplies = parseBoolean(c[23], "Aplica IGTF");
      const igtfBase = parseAmount(c[24], "Base IGTF", igtfApplies);
      if (!igtfApplies && igtfBase !== 0) issue("Hay base IGTF aunque no se indicó que aplique.");
      if (igtfApplies && igtfBase <= 0) issue("La base IGTF debe ser mayor que cero.");
      const exempt = parseAmount(c[9], "Exento");
      const base16 = parseAmount(c[10], "Base 16 %");
      const base8 = parseAmount(c[11], "Base 8 %");
      const ivaRate = parsePercent(c[12], "Retención IVA %", true);
      if (![0, 75, 100].includes(ivaRate)) issue("Retención IVA debe ser 0, 75 o 100 %.");
      if (vendor && ivaRate !== Number(vendor.ivaRetentionRate)) warn("El porcentaje de retención IVA difiere del configurado actualmente para el proveedor.");

      const concept = c[15].trim();
      const islrApplies = Boolean(concept);
      const islrBase = islrApplies ? parseAmount(c[16], "Base ISLR", true) : 0;
      const islrRate = islrApplies ? parsePercent(c[17], "Tasa ISLR %", true) : 0;
      const islrAmount = islrApplies ? parseAmount(c[18], "Monto ISLR", true) : 0;
      const islrTaxableBase = islrApplies ? (c[25] ? parseAmount(c[25], "Base gravable ISLR") : islrBase) : 0;
      const islrSubtraction = islrApplies ? parseAmount(c[26], "Sustraendo ISLR") : 0;
      if (!islrApplies && [c[16], c[17], c[18], c[19], c[25], c[26]].some(Boolean)) issue("Hay datos de ISLR sin indicar concepto.");
      if (islrTaxableBase > islrBase) issue("Base gravable ISLR no puede superar la Base ISLR.");
      if (islrApplies && docType !== "invoice") issue("Notas con retención ISLR siguen bloqueadas por la regla aprobada.");

      const description = c[20].trim();
      const affectedNumber = c[8].trim();
      if (description.length < 10 || description.length > 2000) issue("Descripción debe tener entre 10 y 2.000 caracteres.");
      if (docType === "invoice" && affectedNumber) issue("Una factura no debe indicar Factura afectada.");
      if (docType && docType !== "invoice" && !affectedNumber) issue("La nota requiere número de factura afectada.");
      if (!vendor || !docType || !account || !ceco.length || !number || !issuedAt || !eventAt || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || ![1, 2].includes(half)) continue;

      const calculation = calculateDocument({
        type: c[1], issuedAt, eventAt, period, half,
        periodOverrideReason: period === normalHalf.period && half === normalHalf.half ? "" : "Importación histórica con período ya determinado",
        number, controlNumber: control, affectedDocumentId: docType === "invoice" ? null : "historical-import",
        description, exempt, base16, base8, igtfApplies, igtfBase,
        ivaRetentionRate: ivaRate,
        ivaRetentionReason: ivaRate === 0 ? "Importación histórica: retención 0 %" : "Importación histórica",
        islrApplies, islrConceptCode: concept, islrManual: islrApplies,
        islrManualReason: islrApplies ? "Monto del comprobante histórico" : "",
        islrBase, islrRate, islrAmount, islrSubtraction,
        paymentAccountId: account.id, cecoAllocations: ceco, status: "issued",
      }, vendor, settings, false, true);

      const reportedIva = parseAmount(c[13], "Monto IVA retenido", calculation.ivaRetentionCents !== 0);
      if (Math.round(reportedIva * 100) !== Math.abs(calculation.ivaRetentionCents)) issue("Monto IVA retenido no coincide con bases, alícuotas y porcentaje.");
      const ivaCert = certificateNumber(c[14], period, "Comprobante IVA");
      const islrCert = certificateNumber(c[19], eventAt.slice(0, 7), "Comprobante ISLR");
      if (calculation.ivaRetentionCents !== 0 && !ivaCert) issue("Falta el número original del comprobante IVA.");
      if (calculation.ivaRetentionCents === 0 && ivaCert) issue("Hay comprobante IVA sin retención practicada.");
      if (calculation.islrRetentionCents !== 0 && !islrCert) issue("Falta el número original del comprobante ISLR.");
      if (calculation.islrRetentionCents === 0 && islrCert) issue("Hay comprobante ISLR sin retención practicada.");
      if (ivaCert) {
        batchIva.set(ivaCert, [...(batchIva.get(ivaCert) ?? []), source.row]);
        if (existingIva.has(ivaCert)) issue("El comprobante IVA ya está registrado.");
      }
      if (islrCert) {
        batchIslr.set(islrCert, [...(batchIslr.get(islrCert) ?? []), source.row]);
        if (existingIslr.has(islrCert)) issue("El comprobante ISLR ya está registrado.");
      }
      const expectedIslrCents = Math.max(0, Math.round(Math.round(islrTaxableBase * 100) * islrRate / 100) - Math.round(islrSubtraction * 100));
      if (islrApplies && expectedIslrCents !== Math.round(islrAmount * 100)) warn("El monto ISLR difiere de base gravable × tasa menos sustraendo; revise el comprobante fuente.");
      if (Math.abs(calculation.ivaRetentionCents) > Math.round((base16 * Number(settings.ivaGeneralRate) / 100 + base8 * Number(settings.ivaReducedRate) / 100) * 100)) issue("La retención IVA supera el IVA calculado.");
      if (docType !== "invoice" && islrApplies) issue("No se admite ISLR en notas en esta versión.");

      const sign = docType === "credit_note" ? -1 : 1;
      const calculationSnapshot = {
        ...calculation,
        affectedDocumentId: null,
        ...(docType === "invoice" ? {} : { affectedInvoiceNumber: affectedNumber }),
        islrTaxableBaseCents: Math.round(islrTaxableBase * 100) * sign,
        islrSubtractionCents: Math.round(islrSubtraction * 100) * sign,
      };
      const accountingSnapshot = {
        paymentAccount: { id: account.id, code: account.code, name: account.name },
        cecoAllocations: ceco.map(item => ({ ...item, code: settings.cecos.find(entry => entry.id === item.cecoId)?.code })),
        cecoSummary: calculation.ceco,
      };
      preparedByRow.set(source.row, {
        source_row: source.row,
        fiscal_vendor_id: vendorRow!.id,
        document_type: docType,
        invoice_number: number,
        control_number: control,
        issued_at: issuedAt,
        event_at: eventAt,
        tax_period: period,
        tax_half: half,
        period_override_reason: period === normalHalf.period && half === normalHalf.half ? "" : "Importación histórica con período ya determinado",
        affected_invoice_number: docType === "invoice" ? "" : affectedNumber,
        description,
        exempt_cents: Math.round(exempt * 100),
        base16_cents: Math.round(base16 * 100),
        base8_cents: Math.round(base8 * 100),
        iva_retention_rate: ivaRate,
        iva_retention_reason: ivaRate === 0 ? "Importación histórica: retención 0 %" : "Importación histórica",
        igtf_applies: igtfApplies,
        igtf_base_cents: Math.round(igtfBase * 100),
        islr_applies: islrApplies,
        islr_concept_code: islrApplies ? concept.padStart(3, "0") : "",
        islr_base_cents: Math.round(islrBase * 100),
        islr_manual_cents: islrApplies ? Math.round(islrAmount * 100) : "",
        islr_manual_reason: islrApplies ? "Monto del comprobante histórico" : "",
        islr_manual_rate: islrApplies ? islrRate : "",
        islr_manual_subtraction_cents: Math.round(islrSubtraction * 100),
        payment_account_label: c[21],
        ceco_allocation_note: c[22],
        status: "issued",
        calculation_snapshot: calculationSnapshot,
        accounting_snapshot: accountingSnapshot,
        iva_certificate_number: ivaCert,
        islr_certificate_number: islrCert,
      });
    } catch (error) {
      issue(error instanceof Error ? error.message : "Fila inválida.");
    }
  }

  for (const sourceRowsForKey of batchDocKeys.values()) if (sourceRowsForKey.length > 1) {
    for (const row of sourceRowsForKey) results.find(result => result.row === row)?.issues.push("Número de documento duplicado dentro del archivo.");
  }
  for (const sourceRowsForNumber of batchIva.values()) if (sourceRowsForNumber.length > 1) for (const row of sourceRowsForNumber) results.find(result => result.row === row)?.issues.push("Número de comprobante IVA repetido dentro del archivo.");
  for (const sourceRowsForNumber of batchIslr.values()) if (sourceRowsForNumber.length > 1) for (const row of sourceRowsForNumber) results.find(result => result.row === row)?.issues.push("Número de comprobante ISLR repetido dentro del archivo.");

  for (const result of results) {
    const source = sourceRows.find(item => item.row === result.row)!;
    const docType = source.cells[1] === "factura" ? "invoice" : source.cells[1] === "nota_credito" ? "credit_note" : source.cells[1] === "nota_debito" ? "debit_note" : null;
    const vendorId = vendorByRif.get(normalizedRif(source.cells[0]))?.id;
    if (docType && docType !== "invoice" && source.cells[8].trim()) {
      const key = `${vendorId}|${normalized(source.cells[8])}`;
      const existingInvoice = documents.some(row => row.fiscal_vendor_id === vendorId && row.document_type === "invoice" && row.status === "issued" && normalized(String(row.invoice_number ?? "")) === normalized(source.cells[8]));
      const batchInvoice = results.some(candidate => candidate.isInvoice && candidate.invoiceKey === key && candidate.issues.length === 0);
      if (!existingInvoice && !batchInvoice) result.issues.push("La factura afectada no está emitida para este proveedor ni aparece válida en el archivo.");
    }
  }

  const ready = results.filter(row => row.issues.length === 0).length;
  const blocked = results.length - ready;
  const warningCount = results.reduce((total, row) => total + row.warnings.length, 0);
  const details = results.filter(row => row.issues.length || row.warnings.length).slice(0, MAX_DETAILS)
    .map(({ row, document, issues, warnings }) => ({ row, document, issues, warnings }));
  const report: HistoricalImportValidation = {
    kind: "validated",
    message: blocked === 0 ? "Validación de servidor completada. El archivo todavía no se importó." : "Validación de servidor completada; corrige las filas bloqueadas antes de importar.",
    total: results.length, ready, blocked, warnings: warningCount, details, moreDetails: Math.max(0, results.filter(row => row.issues.length || row.warnings.length).length - details.length),
  };
  const preparedDocuments = results.filter(row => row.issues.length === 0).map(row => preparedByRow.get(row.row)).filter((row): row is PreparedHistoricalDocument => Boolean(row))
    .sort((a, b) => Number(a.document_type !== "invoice") - Number(b.document_type !== "invoice") || a.source_row - b.source_row);
  return { report, preparedDocuments, settingsSnapshot };
}

export async function validateHistoricalImportFile(file: File, access: Access): Promise<HistoricalImportValidation> {
  return (await prepareHistoricalImportFile(file, access)).report;
}

export async function importHistoricalDocumentsFile(file: File, access: Access, acknowledgeWarnings: boolean): Promise<HistoricalImportValidation> {
  const { report, preparedDocuments, settingsSnapshot } = await prepareHistoricalImportFile(file, access);
  if (report.kind === "error" || (report.blocked ?? 0) > 0) return report;
  if ((report.ready ?? 0) === 0 || preparedDocuments.length !== report.ready || !settingsSnapshot) {
    return { ...report, kind: "error", message: "No hay documentos aptos para importar; no se guardó ningún registro." };
  }
  if ((report.warnings ?? 0) > 0 && !acknowledgeWarnings) {
    return { ...report, requiresWarningAcknowledgement: true, message: "Revisa y confirma las observaciones antes de importar." };
  }
  const service = createAdministrationServiceClient();
  if (!service) return { ...report, kind: "error", message: "La importación no está configurada en servidor; falta SUPABASE_SERVICE_ROLE_KEY." };
  const { data, error } = await service.rpc("import_administration_documents", {
    p_organization_id: access.organizationId,
    p_actor_id: access.user.id,
    p_settings_snapshot: settingsSnapshot,
    p_documents: preparedDocuments,
  });
  if (error) {
    const message = error.code === "23505"
      ? "El lote encontró un duplicado creado durante la validación; se revirtió completo. Vuelve a validar el archivo."
      : "No se importó ningún documento; la transacción se revirtió. Actualiza la validación y revisa la configuración fiscal.";
    return { ...report, kind: "error", message };
  }
  const imported = Number((data as { imported_count?: unknown } | null)?.imported_count ?? preparedDocuments.length);
  return {
    ...report,
    imported,
    requiresWarningAcknowledgement: false,
    message: `Importación completada: ${imported} documentos históricos, con comprobantes originales y auditoría.`,
  };
}
