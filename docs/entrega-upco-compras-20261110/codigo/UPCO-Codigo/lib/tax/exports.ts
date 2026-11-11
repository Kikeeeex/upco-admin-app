import type { documents, vendors } from "@/db/schema";
import { fail, money, type TaxSettings } from "./core";

export type JoinedDocument = { document: typeof documents.$inferSelect; vendor: typeof vendors.$inferSelect };
export function parsePeriod(request: Request, requireHalf = false) {
  const q = new URL(request.url).searchParams;
  const period = q.get("period") ?? "";
  const half = q.get("half") ? Number(q.get("half")) : undefined;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) fail("Seleccione un período AAAA-MM");
  if ((half !== undefined && ![1, 2].includes(half)) || (requireHalf && !half)) fail("Seleccione quincena 1 o 2");
  return { period, half };
}
export function bookRows(rows: JoinedDocument[], period: string, half?: number) {
  return rows.filter(x => x.document.status === "issued" && x.document.period === period && (!half || x.document.half === half)).sort((a, b) => a.document.issuedAt.localeCompare(b.document.issuedAt) || a.document.id - b.document.id);
}
export function ivaRows(rows: JoinedDocument[], period: string, half: number) {
  return rows.filter(x => x.document.status === "issued" && x.document.period === period && x.document.half === half).sort((a, b) => a.document.issuedAt.localeCompare(b.document.issuedAt) || a.document.id - b.document.id);
}
export function retentionRows(rows: JoinedDocument[], period: string, half?: number) {
  return rows.filter(x => {
    const d = x.document;
    if (d.status !== "issued" || d.eventAt.slice(0, 7) !== period) return false;
    return !half || (Number(d.eventAt.slice(8)) <= 15 ? 1 : 2) === half;
  }).sort((a, b) => a.document.eventAt.localeCompare(b.document.eventAt) || a.document.id - b.document.id);
}
function decimal(cents: number) { return money(Math.abs(cents)).toFixed(2); }
function documentCode(type: string) { return type === "factura" ? "01" : type === "nota_debito" ? "02" : "03"; }
function escapedXml(value: unknown) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }

export function ivaTxt(rows: JoinedDocument[], all: JoinedDocument[], settings: TaxSettings, period: string, half: number): string {
  const invalidExempt = rows.find(x => x.document.base16Cents === 0 && x.document.base8Cents === 0 && x.document.ivaRetentionCents !== 0);
  if (invalidExempt) fail(`Documento ${invalidExempt.document.number}: una operación totalmente exenta no puede tener retención de IVA`);
  const declarable = rows.filter(x => x.document.ivaRetentionCents !== 0);
  const mixed = declarable.filter(x => x.document.base16Cents !== 0 && x.document.base8Cents !== 0);
  if (mixed.length) fail(`TXT IVA detenido: ${mixed.length} documento(s) mezclan 16 % y 8 %. El formato SENIAT tiene una alícuota por línea; se requiere validación del portal para no duplicar número de control.`);
  for (const { document: d } of declarable) {
    if (d.issuedAt.slice(0, 7) > period) fail(`Documento ${d.number}: fecha de factura posterior al período declarado`);
  }
  const unissued = all.filter(x => x.document.status === "draft" && x.document.period === period && x.document.half === half);
  if (unissued.length) fail(`TXT IVA detenido: hay ${unissued.length} documento(s) en borrador de esta quincena. El libro y el TXT deben cerrarse con los mismos documentos emitidos.`);
  if (!declarable.length) fail("No hay retenciones de IVA en esta quincena. Declare sin movimientos en el portal; no se genera una operación ficticia.");
  const byId = new Map(all.map(x => [x.document.id, x.document]));
  return declarable.map(({ document: d, vendor: v }) => {
    if (!d.ivaCertificateNumber) fail(`Documento ${d.number}: falta número de comprobante IVA`);
    const captured = d.settingsSnapshot ? JSON.parse(d.settingsSnapshot) as TaxSettings : settings;
    const aliquot = d.base16Cents !== 0 ? captured.ivaGeneralRate : captured.ivaReducedRate;
    const affectedDocument = d.affectedDocumentId ? byId.get(d.affectedDocumentId) : undefined;
    const affected = affectedDocument?.number;
    if (d.type !== "factura" && !affected) fail(`Nota ${d.number}: falta factura afectada`);
    if (d.type === "nota_credito" && (
      affectedDocument?.type !== "factura" ||
      affectedDocument.status !== "issued" ||
      affectedDocument.vendorId !== d.vendorId
    )) {
      fail(`Nota de crédito ${d.number}: la factura afectada debe estar emitida y pertenecer al mismo proveedor`);
    }
    if (d.type === "nota_credito" && affectedDocument &&
        (affectedDocument.period !== period || affectedDocument.half !== half)) {
      fail(`TXT IVA detenido: la nota de crédito ${d.number} afecta la factura ${affectedDocument.number} de ${affectedDocument.period} Q${affectedDocument.half}. Revise el ajuste de otra quincena en SENIAT antes de declararlo; no se exporta automáticamente en ${period} Q${half}.`);
    }
    return [
      settings.companyRif, period.replace("-", ""), d.issuedAt, "C", documentCode(d.type), v.rif,
      d.number, d.controlNumber || "0", decimal(d.totalCents), decimal(d.base16Cents + d.base8Cents),
      decimal(d.ivaRetentionCents), affected ?? "0", d.ivaCertificateNumber,
      decimal(d.exemptCents), Number(aliquot).toFixed(2), "0",
    ].join("\t");
  }).join("\r\n") + "\r\n";
}

export function islrXml(rows: JoinedDocument[], all: JoinedDocument[], settings: TaxSettings, period: string): string {
  const declarable = rows.filter(x => x.document.islrRetentionCents !== 0);
  if (!declarable.length) fail("No hay operaciones ISLR declarables en este mes. Use la opción sin movimientos del portal.");
  const unissued = all.filter(x => x.document.status === "draft" && x.document.type === "factura" && x.document.eventAt.slice(0, 7) === period && x.document.islrRetentionCents !== 0);
  if (unissued.length) fail(`XML ISLR detenido: hay ${unissued.length} operación(es) en borrador del mes.`);
  const notes = declarable.filter(x => x.document.type !== "factura");
  if (notes.length) fail("XML ISLR detenido: hay notas de ajuste de ISLR. Revise su tratamiento en el portal antes de declarar.");
  const exportedInvoices = new Map<string, string>();
  const details = declarable.map(({ document: d, vendor: v }) => {
    const exportedRate = Number(Number(d.islrRate).toFixed(2));
    const representedRetention = Math.round(Math.abs(d.islrTaxableBaseCents) * exportedRate / 100);
    if (!Number.isFinite(representedRetention) || representedRetention !== Math.abs(d.islrRetentionCents)) {
      fail(`XML ISLR detenido: la base gravable y alícuota de la factura ${d.number} (${v.rif}) no reproducen el monto retenido. Revise base, sustraendo y comprobante antes de exportar.`);
    }
    const control = d.controlNumber.trim() || "NA";
    const invoice = d.number.length > 10 ? d.number.slice(-10) : d.number;
    if (!/^[A-Za-z0-9]+$/.test(invoice)) fail(`Factura ${d.number}: número no compatible con XML ISLR`);
    const invoiceKey = `${v.rif.toUpperCase()}|${invoice.toUpperCase()}`;
    const previousInvoice = exportedInvoices.get(invoiceKey);
    if (previousInvoice && previousInvoice !== d.number) {
      fail(`XML ISLR detenido: las facturas ${previousInvoice} y ${d.number} del proveedor ${v.rif} coinciden en los últimos diez caracteres (${invoice})`);
    }
    exportedInvoices.set(invoiceKey, d.number);
    const date = `${d.eventAt.slice(8)}/${d.eventAt.slice(5, 7)}/${d.eventAt.slice(0, 4)}`;
    return `<DetalleRetencion><RifRetenido>${escapedXml(v.rif)}</RifRetenido><NumeroFactura>${escapedXml(invoice)}</NumeroFactura><NumeroControl>${escapedXml(control)}</NumeroControl><FechaOperacion>${date}</FechaOperacion><CodigoConcepto>${escapedXml(d.islrConceptCode)}</CodigoConcepto><MontoOperacion>${decimal(d.islrTaxableBaseCents)}</MontoOperacion><PorcentajeRetencion>${exportedRate.toFixed(2)}</PorcentajeRetencion></DetalleRetencion>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><RelacionRetencionesISLR RifAgente="${escapedXml(settings.companyRif)}" Periodo="${period.replace("-", "")}">${details}</RelacionRetencionesISLR>`;
}

export function ivaReconciliation(rows: JoinedDocument[], period: string, half: number) {
  const book = bookRows(rows, period, half);
  const retention = ivaRows(rows, period, half);
  const declarable = retention.filter(x => x.document.ivaRetentionCents !== 0);
  const excluded = book.filter(x => x.document.ivaRetentionCents === 0);
  const dateMismatch = declarable.filter(x => x.document.eventAt.slice(0, 7) !== period || (Number(x.document.eventAt.slice(8)) <= 15 ? 1 : 2) !== half);
  return {
    period, half,
    bookDocuments: book.length,
    bookTotal: money(book.reduce((n, x) => n + x.document.totalCents, 0)),
    bookIvaRetained: money(book.reduce((n, x) => n + x.document.ivaRetentionCents, 0)),
    txtDocuments: declarable.length,
    txtIvaRetained: money(declarable.reduce((n, x) => n + x.document.ivaRetentionCents, 0)),
    excludedZeroRetention: excluded.map(x => ({ id: x.document.id, number: x.document.number, reason: x.document.ivaRetentionReason })),
    periodOverrides: dateMismatch.map(x => ({ id: x.document.id, number: x.document.number, eventAt: x.document.eventAt, reason: x.document.periodOverrideReason })),
    priorPeriodNotes: declarable.filter(x => x.document.type === "nota_credito" && x.document.affectedDocumentId && rows.some(original => original.document.id === x.document.affectedDocumentId && (original.document.period !== period || original.document.half !== half))).map(x => ({ id: x.document.id, number: x.document.number, affectedDocumentId: x.document.affectedDocumentId, reason: "Revise el ajuste contra el período original en SENIAT" })),
    mixedRateBlocked: declarable.filter(x => x.document.base16Cents !== 0 && x.document.base8Cents !== 0).map(x => ({ id: x.document.id, number: x.document.number })),
  };
}
