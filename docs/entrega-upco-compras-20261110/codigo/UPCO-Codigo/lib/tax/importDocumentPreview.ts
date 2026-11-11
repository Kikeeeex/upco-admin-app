import { documents, vendors } from "@/db/schema";
import { calculateDocument, fail, fiscalHalf, validateDate, type TaxSettings, type VendorInput } from "./core";
import type { ImportRawRow } from "./importSpreadsheet";
type Vendor = typeof vendors.$inferSelect;
type Document = typeof documents.$inferSelect;
type Calculated = ReturnType<typeof calculateDocument>;
type Prepared = { sourceRow: number; rif: string; vendorId: number; affectedNumber: string; ivaCertificate: string; islrCertificate: string; values: Calculated };
type PreviewRow = { row: number; values: { rif: string; type: string; number: string; issuedAt: string; eventAt: string; period: string; half: number }; issues: string[]; warnings: string[] };
const normalizedRif = (value: string) => value.toUpperCase().replace(/[\s-]/g, "");
export const normalize = (value: string) => value.trim().toUpperCase();

function amount(value: string, label: string, required = false): number {
  const source = value.trim();
  if (!source) { if (required) fail(`${label} obligatorio`); return 0; }
  if (/^\d{1,3}\.\d{3}$/.test(source)) fail(`${label}: formato ambiguo; use 1234,00 o 1234.00`);
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(source)) return Number(source.replace(/\./g, "").replace(",", "."));
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(source)) fail(`${label}: use un monto positivo con máximo dos decimales`);
  return Number(source.replace(",", "."));
}
function percentage(value: string, label: string, required = false): number {
  const result = amount(value, label, required);
  if (!Number.isFinite(result) || result < 0 || result > 100) fail(`${label}: porcentaje inválido`);
  return result;
}
function boolean(value: string, label: string) {
  const normalized = value.trim().toLowerCase();
  if (["sí", "si", "1"].includes(normalized)) return true;
  if (["no", "0"].includes(normalized)) return false;
  fail(`${label}: escriba Sí/No o 1/0`);
}
function certificate(value: string, period: string, label: string) {
  const number = value.trim();
  if (!number) return "";
  if (!/^\d{14}$/.test(number) || !number.startsWith(period.replace("-", "")) || Number(number.slice(6)) < 1) {
    fail(`${label}: se esperaba AAAAMM seguido de ocho dígitos para ${period}`);
  }
  return number;
}
function cecoAllocations(source: string, settings: TaxSettings) {
  if (!source.trim()) fail("CECO reparto obligatorio; use CODIGO:PORCENTAJE;CODIGO:PORCENTAJE");
  return source.split(";").map(part => {
    const match = /^\s*([^:;]+)\s*:\s*([^:;]+)\s*$/.exec(part);
    if (!match) fail("CECO reparto: use CODIGO:PORCENTAJE;CODIGO:PORCENTAJE");
    const ceco = settings.cecos.find(item => item.active && normalize(item.code) === normalize(match[1]));
    if (!ceco) fail(`CECO ${match[1].trim()} no existe o está inactivo`);
    return { cecoId: ceco.id, percentage: percentage(match[2], "Porcentaje CECO", true) };
  });
}

export function inspectRows(rawRows: ImportRawRow[], vendorRows: Vendor[], existing: Document[], settings: TaxSettings) {
  const byRif = new Map(vendorRows.map(vendor => [normalizedRif(vendor.rif), vendor]));
  const existingKeys = new Set(existing.map(document => `${document.vendorId}|${document.type}|${normalize(document.number)}`));
  const existingInvoices = new Set(existing.filter(document => document.type === "factura" && document.status === "issued").map(document => `${document.vendorId}|${normalize(document.number)}`));
  const historical = (document: Document) => {
    try { return JSON.parse(document.accountingSnapshot || "{}").historicalImport === true; }
    catch { return false; }
  };
  const claims = (kind: "iva" | "islr") => {
    const result = new Map<string, Document[]>();
    for (const document of existing) {
      const certificate = kind === "iva" ? document.ivaCertificateNumber : document.islrCertificateNumber;
      if (!certificate) continue;
      const suffix = certificate.slice(6);
      result.set(suffix, [...(result.get(suffix) || []), document]);
    }
    return result;
  };
  const existingIva = claims("iva"), existingIslr = claims("islr");
  const batchKeys = new Set<string>();
  const batchIva = new Map<string, { vendorId: number; certificate: string }>();
  const batchIslr = new Map<string, { vendorId: number; certificate: string }>();
  const batchInvoices = new Set(rawRows.filter(item => item.cells[1] === "factura").map(item => `${normalizedRif(item.cells[0])}|${normalize(item.cells[6])}`));
  const rows: PreviewRow[] = [], prepared: Prepared[] = [];
  for (const item of rawRows) {
    const c = item.cells;
    const rif = normalizedRif(c[0]), type = c[1], number = c[6].trim();
    const preview: PreviewRow = { row: item.row, values: { rif, type, number, issuedAt: c[2], eventAt: c[3], period: c[4], half: Number(c[5]) || 0 }, issues: [], warnings: [] };
    const issue = (message: string) => preview.issues.push(message);
    rows.push(preview);
    try {
      if (c.some(value => /^[=+@]/.test(value.trim()))) fail("La fila contiene una fórmula o contenido que comienza con =, + o @");
      if (!/^[VEJPG]\d{9}$/.test(rif)) fail("RIF proveedor inválido");
      const vendor = byRif.get(rif);
      if (!vendor) fail(`El proveedor ${rif} no está registrado`);
      if (!vendor.active) fail(`El proveedor ${rif} está inactivo`);
      if (!number || !c[7].trim()) fail("Número de documento y número de control son obligatorios");
      const issuedAt = validateDate(c[2], "Fecha emisión"), eventAt = validateDate(c[3], "Pago o abono");
      const normalHalf = fiscalHalf(eventAt);
      const period = c[4] || normalHalf.period, half = c[5] ? Number(c[5]) : normalHalf.half;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || ![1, 2].includes(half)) fail("Período IVA o quincena inválidos");
      preview.values = { rif, type, number, issuedAt, eventAt, period, half };
      const key = `${vendor.id}|${type}|${normalize(number)}`;
      if (existingKeys.has(key) || batchKeys.has(key)) issue("Documento duplicado para este proveedor, tipo y número");
      batchKeys.add(key);
      const affectedNumber = c[8].trim();
      if (type !== "factura") {
        if (!affectedNumber) issue("La nota requiere número de factura afectada");
        else if (!existingInvoices.has(`${vendor.id}|${normalize(affectedNumber)}`) && !batchInvoices.has(`${rif}|${normalize(affectedNumber)}`)) issue("La factura afectada no está emitida en el sistema ni aparece en este archivo");
      }
      const account = settings.paymentAccounts.find(value => value.active && normalize(value.code) === normalize(c[21]));
      if (!account) fail(`Cuenta de pago ${c[21] || "(vacía)"} no existe o está inactiva`);
      const igtfApplies = boolean(c[23], "Aplica IGTF");
      const igtfBase = amount(c[24], "Base IGTF", igtfApplies);
      if (!igtfApplies && igtfBase !== 0) issue("Base IGTF indicada aunque no aplica IGTF");
      const islrApplies = Boolean(c[15].trim());
      if (!islrApplies && [c[16], c[17], c[18], c[19], c[25], c[26]].some(Boolean)) issue("Hay datos de ISLR sin concepto");
      const islrBase = islrApplies ? amount(c[16], "Base ISLR", true) : 0;
      const taxableBase = islrApplies && c[25] ? amount(c[25], "Base gravable ISLR") : islrBase;
      const islrSubtraction = islrApplies ? amount(c[26], "Sustraendo ISLR") : 0;
      if (Math.round(taxableBase * 100) > Math.round(islrBase * 100)) issue("Base gravable ISLR no puede superar Base ISLR");
      const calculated = calculateDocument({
        type, issuedAt, eventAt, period, half, periodOverrideReason: period === normalHalf.period && half === normalHalf.half ? "" : "Importación histórica con diferimiento ya practicado",
        number, controlNumber: c[7], affectedDocumentId: type === "factura" ? null : 1,
        exempt: amount(c[9], "Exento"), base16: amount(c[10], "Base 16%"), base8: amount(c[11], "Base 8%"),
        igtfApplies, igtfBase,
        ivaRetentionRate: percentage(c[12], "Retención IVA %", true), ivaRetentionReason: c[12] === "0" ? "Importación histórica: retención 0 %" : "Importación histórica",
        islrApplies, islrConceptCode: c[15], islrManual: islrApplies,
        islrManualReason: islrApplies ? "Monto original de comprobante histórico" : "",
        islrBase, islrSubtraction,
        islrRate: islrApplies ? percentage(c[17], "Tasa ISLR %", true) : 0,
        islrAmount: islrApplies ? amount(c[18], "Monto ISLR", true) : 0,
        description: c[20], paymentAccountId: account.id, cecoAllocations: cecoAllocations(c[22], settings), status: "issued",
      }, vendor as VendorInput, settings);
      // A historical manual retention may use only part of the ISLR base.
      // calculateDocument signs credit notes; preserve that sign for both fields.
      const sign = type === "nota_credito" ? -1 : 1;
      calculated.islrTaxableBaseCents = Math.round(taxableBase * 100) * sign;
      calculated.islrSubtractionCents = Math.round(islrSubtraction * 100) * sign;
      const rateForExport = Math.round(calculated.islrRate * 100) / 100;
      if (islrApplies && Math.max(0, Math.round(Math.abs(calculated.islrTaxableBaseCents) * rateForExport / 100) - Math.abs(calculated.islrSubtractionCents)) !== Math.abs(calculated.islrRetentionCents)) {
        preview.warnings.push("Monto ISLR difiere de base gravable × tasa menos sustraendo; verifique el comprobante antes de exportar la macro");
      }
      const reportedIva = amount(c[13], "Monto IVA retenido", calculated.ivaRetentionCents !== 0);
      if (Math.round(reportedIva * 100) !== Math.abs(calculated.ivaRetentionCents)) issue("Monto IVA retenido no coincide con bases, alícuota y porcentaje");
      const ivaCertificate = certificate(c[14], period, "Comprobante IVA");
      const islrCertificate = certificate(c[19], eventAt.slice(0, 7), "Comprobante ISLR");
      if (calculated.ivaRetentionCents !== 0 && !ivaCertificate) issue("Falta número ORIGINAL de comprobante IVA");
      if (calculated.ivaRetentionCents === 0 && ivaCertificate) issue("Comprobante IVA sin retención practicada");
      if (calculated.islrRetentionCents !== 0 && !islrCertificate) issue("Falta número ORIGINAL de comprobante ISLR");
      if (calculated.islrRetentionCents === 0 && islrCertificate) issue("Comprobante ISLR sin retención practicada");
      const ivaSuffix = ivaCertificate.slice(6), islrSuffix = islrCertificate.slice(6);
      const sharedVoucher = (prior: Document[] | undefined, batch: { vendorId: number; certificate: string } | undefined, certificate: string) =>
        (!prior || prior.every(document => document.vendorId === vendor.id && historical(document) &&
          (document.ivaCertificateNumber === certificate || document.islrCertificateNumber === certificate))) &&
        (!batch || (batch.vendorId === vendor.id && batch.certificate === certificate));
      if (ivaCertificate && !sharedVoucher(existingIva.get(ivaSuffix), batchIva.get(ivaSuffix), ivaCertificate)) issue("Correlativo IVA usado por otro proveedor, mes o documento no histórico");
      if (islrCertificate && !sharedVoucher(existingIslr.get(islrSuffix), batchIslr.get(islrSuffix), islrCertificate)) issue("Correlativo ISLR usado por otro proveedor, mes o documento no histórico");
      if (ivaCertificate) batchIva.set(ivaSuffix, { vendorId: vendor.id, certificate: ivaCertificate });
      if (islrCertificate) batchIslr.set(islrSuffix, { vendorId: vendor.id, certificate: islrCertificate });
      if (type !== "factura" && islrApplies) issue("Nota con ISLR requiere revisión manual del tratamiento fiscal antes de importar");
      if (!preview.issues.length) prepared.push({ sourceRow: item.row, rif, vendorId: vendor.id, affectedNumber, ivaCertificate, islrCertificate, values: calculated });
    } catch (error) { issue(error instanceof Error ? error.message : "Fila inválida"); }
  }
  return { rows, summary: { total: rows.length, ready: rows.filter(row => !row.issues.length).length, blocked: rows.filter(row => row.issues.length).length }, prepared, settings };
}

