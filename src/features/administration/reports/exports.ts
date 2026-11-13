import type { getAccessContext } from "@/features/auth/access";
import { makeBookXlsx, type BookRow, type JoinedDocument } from "./source-xlsx";
import { readApprovedTaxSettings } from "../documents/tax-settings";
import { makeMonthlyCloseXlsx, monthlyCloseRows } from "./source-close-xlsx";
import { fail, validateDate } from "../documents/tax-engine";

type Allowed = Extract<Awaited<ReturnType<typeof getAccessContext>>, { kind: "allowed" }>;
type TaxRow = {
  id: string; organization_id: string; fiscal_vendor_id: string | null; document_type: string; invoice_number: string | null;
  control_number: string | null; issued_at: string | null; event_at: string | null; tax_period: string | null; tax_half: number | null; description: string;
  payment_account_label: string | null; ceco_allocation_note: string | null;
  affected_document_id: string | null; status: string; islr_applies: boolean; calculation_snapshot: Record<string, unknown> | null;
  settings_snapshot: Record<string, unknown> | null; accounting_snapshot: Record<string, unknown> | null;
  iva_certificate_number: string | null; islr_certificate_number: string | null;
};
type Vendor = { id: string; legal_name: string; tax_identifier: string; taxpayer_type: string };

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function cents(row: TaxRow, key: string) { return Number(jsonObject(row.calculation_snapshot)[key] ?? 0); }
function amount(value: number) { return (Math.abs(value) / 100).toFixed(2); }
function periodParts(value: string | null) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error("Indica un período válido en formato AAAA-MM.");
  return value;
}
function docCode(type: string) { return type === "invoice" ? "01" : type === "debit_note" ? "02" : "03"; }
function escapeXml(value: unknown) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;"); }

async function loadRows(access: Allowed): Promise<{ rows: TaxRow[]; vendors: Map<string, Vendor> }> {
  const rows: TaxRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await access.supabase.from("administration_documents")
      .select("id, organization_id, fiscal_vendor_id, document_type, invoice_number, control_number, issued_at, event_at, tax_period, tax_half, affected_document_id, description, payment_account_label, ceco_allocation_note, status, islr_applies, calculation_snapshot, settings_snapshot, accounting_snapshot, iva_certificate_number, islr_certificate_number")
      .eq("organization_id", access.organizationId).order("issued_at", { ascending: true }).range(offset, offset + 999);
    if (error || !data) throw new Error("No fue posible cargar documentos de Administración.");
    rows.push(...data as TaxRow[]);
    if (data.length < 1000) break;
  }
  const ids = [...new Set(rows.map((row) => row.fiscal_vendor_id).filter((id): id is string => Boolean(id)))];
  const vendors: Vendor[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    const vendorResult = await access.supabase.from("fiscal_vendors").select("id, legal_name, tax_identifier, taxpayer_type").eq("organization_id", access.organizationId).in("id", chunk);
    if (vendorResult.error || !vendorResult.data) throw new Error("No fue posible cargar el directorio fiscal.");
    vendors.push(...vendorResult.data);
  }
  return { rows, vendors: new Map(vendors.map((vendor) => [vendor.id, vendor])) };
}

function rowPeriod(row: TaxRow) { return row.tax_period ?? row.event_at?.slice(0, 7) ?? ""; }
function rowHalf(row: TaxRow) { return row.tax_half ?? (row.event_at ? (Number(row.event_at.slice(8, 10)) <= 15 ? 1 : 2) : null); }

export async function buildIvaTxt(access: Allowed, periodInput: string | null, halfInput: string | null): Promise<string> {
  const period = periodParts(periodInput);
  const half = Number(halfInput);
  if (![1, 2].includes(half)) throw new Error("Indica la quincena 1 o 2.");
  const { rows, vendors } = await loadRows(access);
  const periodRows = rows.filter((row) => rowPeriod(row) === period && rowHalf(row) === half);
  const drafts = periodRows.filter((row) => row.status === "draft");
  if (drafts.length) throw new Error(`Exportación detenida: hay ${drafts.length} borrador(es) en ${period}, quincena ${half}.`);
  const emitted = periodRows.filter((row) => row.status === "issued");
  const reportable = emitted.filter((row) => cents(row, "ivaRetentionCents") !== 0);
  if (!reportable.length) throw new Error("No hay retenciones IVA en esta quincena; no se genera un TXT sin movimientos.");
  const settings = jsonObject(jsonObject(reportable[0].settings_snapshot).config);
  const rif = String(jsonObject(settings.company).rif ?? "");
  if (!rif) throw new Error("La configuración congelada no contiene el RIF del agente de retención.");
  const byId = new Map(rows.map((row) => [row.id, row]));
  const lines = reportable.map((row) => {
    const calc = jsonObject(row.calculation_snapshot);
    if (Number(calc.base16Cents ?? 0) !== 0 && Number(calc.base8Cents ?? 0) !== 0) throw new Error(`TXT IVA detenido: ${row.invoice_number} mezcla alícuotas 16 % y 8 % en una sola línea.`);
    if (row.issued_at && row.issued_at.slice(0, 7) > period) throw new Error(`La fecha de factura ${row.invoice_number} es posterior al período declarado.`);
    const vendor = row.fiscal_vendor_id ? vendors.get(row.fiscal_vendor_id) : undefined;
    if (!vendor) throw new Error(`No se encontró el proveedor fiscal de ${row.invoice_number}.`);
    const affected = row.affected_document_id ? byId.get(row.affected_document_id) : undefined;
    if (row.document_type !== "invoice" && !affected) throw new Error(`La nota ${row.invoice_number} no tiene factura afectada.`);
    if (row.document_type === "credit_note" && affected && (affected.status !== "issued" || affected.document_type !== "invoice" || affected.fiscal_vendor_id !== row.fiscal_vendor_id)) {
      throw new Error(`La factura afectada por ${row.invoice_number} no es válida.`);
    }
    if (row.document_type === "credit_note" && affected && (affected.tax_period !== period || affected.tax_half !== half)) {
      throw new Error(`La nota ${row.invoice_number} afecta una factura de otro período; revise el ajuste antes de exportar.`);
    }
    if (!row.iva_certificate_number) throw new Error(`Falta el comprobante IVA de ${row.invoice_number}.`);
    const config = jsonObject(jsonObject(row.settings_snapshot).config);
    const rates = jsonObject(config.iva);
    const aliquot = Number(calc.base16Cents ?? 0) !== 0 ? Number(rates.general_rate ?? 16) : Number(rates.reduced_rate ?? 8);
    return [rif, period.replace("-", ""), row.issued_at ?? "", "C", docCode(row.document_type), vendor.tax_identifier,
      row.invoice_number ?? "", row.control_number || "0", amount(cents(row, "totalCents")),
      amount(cents(row, "base16Cents") + cents(row, "base8Cents")), amount(cents(row, "ivaRetentionCents")),
      affected?.invoice_number ?? "0", row.iva_certificate_number, amount(cents(row, "exemptCents")), aliquot.toFixed(2), "0"].join("\t");
  });
  return `${lines.join("\r\n")}\r\n`;
}

export async function buildIslrXml(access: Allowed, periodInput: string | null): Promise<string> {
  const period = periodParts(periodInput);
  const { rows, vendors } = await loadRows(access);
  const reportable = rows.filter((row) => row.status === "issued" && row.event_at?.slice(0, 7) === period && cents(row, "islrRetentionCents") !== 0);
  const drafts = rows.filter((row) => row.status === "draft" && row.event_at?.slice(0, 7) === period && row.document_type === "invoice" && row.islr_applies);
  if (drafts.length) throw new Error(`XML ISLR detenido: hay ${drafts.length} factura(s) en borrador para ${period}.`);
  if (!reportable.length) throw new Error("No hay operaciones ISLR declarables en este mes; no se genera un XML sin movimientos.");
  if (reportable.some((row) => row.document_type !== "invoice")) throw new Error("XML ISLR detenido: hay notas de ajuste. Revise su tratamiento antes de declarar.");
  const settings = jsonObject(jsonObject(reportable[0].settings_snapshot).config);
  const rif = String(jsonObject(settings.company).rif ?? "");
  if (!rif) throw new Error("La configuración congelada no contiene el RIF del agente de retención.");
  const seen = new Map<string, string>();
  const details = reportable.map((row) => {
    const calc = jsonObject(row.calculation_snapshot);
    const taxableBase = Number(calc.islrTaxableBaseCents ?? 0);
    const rate = Number(calc.islrRate ?? 0);
    const represented = Math.round(Math.abs(taxableBase) * rate / 100);
    if (represented !== Math.abs(cents(row, "islrRetentionCents"))) throw new Error(`XML ISLR detenido: base y alícuota no reproducen la retención de ${row.invoice_number}.`);
    if (!row.islr_certificate_number) throw new Error(`Falta el comprobante ISLR de ${row.invoice_number}.`);
    const vendor = row.fiscal_vendor_id ? vendors.get(row.fiscal_vendor_id) : undefined;
    if (!vendor) throw new Error(`No se encontró el proveedor fiscal de ${row.invoice_number}.`);
    const invoice = String(row.invoice_number ?? "").slice(-10);
    if (!/^[A-Za-z0-9]+$/.test(invoice)) throw new Error(`Número de factura incompatible con XML ISLR: ${row.invoice_number}.`);
    const key = `${vendor.tax_identifier.toUpperCase()}|${invoice.toUpperCase()}`;
    const prior = seen.get(key);
    if (prior && prior !== row.invoice_number) throw new Error(`Dos facturas del proveedor coinciden en los últimos diez caracteres: ${prior} y ${row.invoice_number}.`);
    seen.set(key, row.invoice_number ?? "");
    const date = (row.event_at ?? "").split("-").reverse().join("/");
    return `<DetalleRetencion><RifRetenido>${escapeXml(vendor.tax_identifier)}</RifRetenido><NumeroFactura>${escapeXml(invoice)}</NumeroFactura><NumeroControl>${escapeXml(row.control_number || "NA")}</NumeroControl><FechaOperacion>${date}</FechaOperacion><CodigoConcepto>${escapeXml(calc.islrConceptCode)}</CodigoConcepto><MontoOperacion>${amount(taxableBase)}</MontoOperacion><PorcentajeRetencion>${rate.toFixed(2)}</PorcentajeRetencion></DetalleRetencion>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><RelacionRetencionesISLR RifAgente="${escapeXml(rif)}" Periodo="${period.replace("-", "")}">${details}</RelacionRetencionesISLR>`;
}

export async function buildIslrMacroXlsx(access: Allowed, periodInput: string | null): Promise<Uint8Array> {
  const period = periodParts(periodInput);
  await buildIslrXml(access, period);
  const { rows, vendors } = await loadRows(access);
  const selected = rows.filter((row) => row.status === "issued" && row.tax_period === period && row.islr_applies && cents(row, "islrRetentionCents") !== 0);
  if (!selected.length) throw new Error("No hay retenciones ISLR en el período seleccionado.");
  const settings = jsonObject(jsonObject(selected[0].settings_snapshot).config);
  const agentRif = String(jsonObject(settings.company).rif ?? "");
  if (!agentRif) throw new Error("La configuración congelada no contiene el RIF del agente de retención.");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("retISLR");
  sheet.addRows([
    ["Data para Crear archivo XML de retISRLSalariosOtras", null, null, null, null, null, "RIF Agente :", agentRif],
    ["RUTA SALIDA DE ARCHIVO XML:", null, null, null, null, null, "Periodo :", period.replace("-", "")],
    ["ID-", "RIF", "Número", "Número", "Fecha", "Codigo", "Monto", "Porcentaje"],
    ["Sec.", "Retenido", "Factura", "Control", "Operación", "Concepto", "Operación", "Retención"],
  ]);
  selected.forEach((row, index) => {
    const vendor = row.fiscal_vendor_id ? vendors.get(row.fiscal_vendor_id) : undefined;
    if (!vendor) throw new Error(`No se encontró el proveedor fiscal de ${row.invoice_number ?? row.id}.`);
    const snapshot = jsonObject(row.calculation_snapshot);
    const date = row.event_at ? new Date(`${row.event_at}T12:00:00-04:00`) : null;
    sheet.addRow([index + 1, vendor.tax_identifier, (row.invoice_number ?? "").slice(-10), row.control_number || "NA", date, Number(snapshot.islrConceptCode ?? 0), Number(snapshot.islrTaxableBaseCents ?? 0) / 100, Number(snapshot.islrRate ?? 0)]);
  });
  sheet.columns = [{ width: 13 }, { width: 18 }, { width: 20 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 20 }];
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  [1, 2].forEach((rowNumber) => sheet.getRow(rowNumber).font = { bold: true, color: { argb: "FF114C38" } });
  [3, 4].forEach((rowNumber) => {
    const row = sheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF114C38" } };
  });
  sheet.getColumn(5).numFmt = "dd/mm/yyyy";
  sheet.getColumn(7).numFmt = "#,##0.00";
  sheet.getColumn(8).numFmt = "0.00";
  const bytes = await workbook.xlsx.writeBuffer();
  return new Uint8Array(bytes);
}

export async function buildBookXlsx(access: Allowed, periodInput: string | null, halfInput: string | null): Promise<Uint8Array> {
  const period = periodParts(periodInput);
  const half = halfInput ? Number(halfInput) : undefined;
  if (half !== undefined && ![1, 2].includes(half)) throw new Error("La quincena debe ser 1 o 2.");
  const { rows, vendors } = await loadRows(access);
  const allIssued = rows.filter((row) => row.status === "issued");
  const selected = allIssued.filter((row) => row.tax_period === period && (!half || row.tax_half === half));
  if (!selected.length) throw new Error("No hay documentos emitidos para el período seleccionado.");
  const firstConfig = jsonObject(jsonObject(selected[0].settings_snapshot).config);
  const taxSettings = readApprovedTaxSettings(firstConfig);
  const toJoined = (row: TaxRow): BookRow => {
    const vendor = row.fiscal_vendor_id ? vendors.get(row.fiscal_vendor_id) : undefined;
    if (!vendor) throw new Error(`Falta el proveedor fiscal de ${row.invoice_number ?? row.id}.`);
    return {
      document: {
        id: row.id, status: row.status, period: row.tax_period ?? period, half: row.tax_half ?? 1,
        issuedAt: row.issued_at ?? "", eventAt: row.event_at ?? "", type: row.document_type === "invoice" ? "factura" : row.document_type === "credit_note" ? "nota_credito" : "nota_debito",
        number: row.invoice_number ?? "", controlNumber: row.control_number ?? "", vendorId: vendor.id, affectedDocumentId: row.affected_document_id,
        description: row.description, totalCents: cents(row, "totalCents"), exemptCents: cents(row, "exemptCents"),
        base16Cents: cents(row, "base16Cents"), iva16Cents: cents(row, "iva16Cents"), base8Cents: cents(row, "base8Cents"),
        iva8Cents: cents(row, "iva8Cents"), subtotalCents: cents(row, "subtotalCents"), ivaRetentionCents: cents(row, "ivaRetentionCents"),
        ivaCertificateNumber: row.iva_certificate_number, islrCertificateNumber: row.islr_certificate_number,
        islrRetentionCents: cents(row, "islrRetentionCents"), igtfBaseCents: cents(row, "igtfBaseCents"),
        igtfAmountCents: cents(row, "igtfAmountCents"), netPayableCents: cents(row, "netPayableCents"),
        accountingSnapshot: JSON.stringify(row.accounting_snapshot ?? {}), cecoAllocations: JSON.stringify([]),
        paymentAccountId: Number(jsonObject(row.accounting_snapshot).paymentAccount && (jsonObject(row.accounting_snapshot).paymentAccount as Record<string, unknown>).id) || null,
      },
      vendor: { id: vendor.id, rif: vendor.tax_identifier, name: vendor.legal_name, taxpayerType: vendor.taxpayer_type },
    };
  };
  const joined = selected.map(toJoined);
  const allJoined = allIssued.map(toJoined);
  return makeBookXlsx(joined, period, half, taxSettings, allJoined);
}

export async function buildCloseXlsx(access: Allowed, fromInput: string | null, toInput: string | null): Promise<Uint8Array> {
  const from = validateDate(fromInput, "Fecha desde");
  const to = validateDate(toInput, "Fecha hasta");
  if (from > to) fail("La fecha desde debe ser anterior o igual a la fecha hasta.");
  const { rows, vendors } = await loadRows(access);
  const issued = rows.filter((row) => row.status === "issued");
  const first = issued.find((row) => row.event_at && row.event_at >= from && row.event_at <= to);
  if (!first) throw new Error("No hay documentos emitidos en el rango de fechas de pago o abono.");
  const settings = readApprovedTaxSettings(jsonObject(jsonObject(first.settings_snapshot).config));
  const joined = issued.map((row): JoinedDocument => {
    const vendor = row.fiscal_vendor_id ? vendors.get(row.fiscal_vendor_id) : undefined;
    if (!vendor) throw new Error(`Falta el proveedor fiscal de ${row.invoice_number ?? row.id}.`);
    const accounting = jsonObject(row.accounting_snapshot);
    const account = jsonObject(accounting.paymentAccount);
    const allocations = Array.isArray(accounting.cecoAllocations) ? accounting.cecoAllocations as Record<string, unknown>[] : [];
    const cecos = allocations.map((item) => ({
      cecoId: Number(item.cecoId), percentage: Number(item.percentage), code: String(item.code ?? ""),
    }));
    return {
      document: {
        id: row.id, status: row.status, period: row.tax_period ?? "", half: row.tax_half ?? 1,
        issuedAt: row.issued_at ?? "", eventAt: row.event_at ?? "", type: row.document_type === "invoice" ? "factura" : row.document_type === "credit_note" ? "nota_credito" : "nota_debito",
        number: row.invoice_number ?? "", controlNumber: row.control_number ?? "", vendorId: vendor.id, affectedDocumentId: row.affected_document_id,
        description: row.description, totalCents: cents(row, "totalCents"), exemptCents: cents(row, "exemptCents"),
        base16Cents: cents(row, "base16Cents"), iva16Cents: cents(row, "iva16Cents"), base8Cents: cents(row, "base8Cents"),
        iva8Cents: cents(row, "iva8Cents"), subtotalCents: cents(row, "subtotalCents"), ivaRetentionCents: cents(row, "ivaRetentionCents"),
        ivaCertificateNumber: row.iva_certificate_number, islrCertificateNumber: row.islr_certificate_number,
        islrRetentionCents: cents(row, "islrRetentionCents"), igtfBaseCents: cents(row, "igtfBaseCents"),
        igtfAmountCents: cents(row, "igtfAmountCents"), netPayableCents: cents(row, "netPayableCents"),
        accountingSnapshot: JSON.stringify({
          paymentAccount: { id: account.id, code: account.code, name: account.name },
          cecos: cecos.map((item) => ({ id: item.cecoId, code: item.code, name: settings.cecos.find((ceco) => ceco.id === item.cecoId)?.name ?? "CECO no encontrado", percentage: item.percentage })),
        }),
        cecoAllocations: JSON.stringify(cecos), paymentAccountId: Number(account.id) || null,
      },
      vendor: { id: vendor.id, rif: vendor.tax_identifier, name: vendor.legal_name, taxpayerType: vendor.taxpayer_type },
    };
  });
  const rangeRows = monthlyCloseRows(joined, from, to);
  return makeMonthlyCloseXlsx(rangeRows, from, to, settings);
}
