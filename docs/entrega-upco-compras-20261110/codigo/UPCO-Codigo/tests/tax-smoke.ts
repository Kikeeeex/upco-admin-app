import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calculateDocument, DEFAULT_SETTINGS } from "../lib/tax/core";
import { makeRetentionPdf } from "../lib/tax/pdf";
import { makeBookXlsx } from "../lib/tax/xlsx";
import { makeIslrDataXlsx } from "../lib/tax/islrXlsx";
import { ivaTxt, islrXml } from "../lib/tax/exports";

const vendor = { id: 1, rif: "J407117998", name: "AGUIRRE CONSULTORES C A", address: "MARACAIBO", taxpayerType: "ordinario" as const, personType: "juridica" as const, residency: "domiciliada" as const, ivaRetentionRate: 100 as const, active: true, email: "", phone: "", createdAt: "", updatedAt: "" };
const settings = {
  ...DEFAULT_SETTINGS,
  cecos: [{ id: 1, code: "ADM", name: "Administración", active: true }],
  paymentAccounts: [{ id: 1, code: "BANCO", name: "Cuenta de prueba", active: true }],
};
const input = {
  type: "factura", vendorId: 1, issuedAt: "2026-09-29", eventAt: "2026-10-15", period: "2026-10", half: 1,
  number: "000063", controlNumber: "00-000063", exempt: 0, base16: 124517.81, base8: 0,
  ivaRetentionRate: 100, ivaRetentionReason: "Condición verificada en portal fiscal",
  islrApplies: true, islrConceptCode: "055", islrBase: 124517.81,
  description: "Servicio de consultoría para la oficina",
  paymentAccountId: 1, cecoAllocations: [{ cecoId: 1, percentage: 100 }],
};
const calculated = calculateDocument(input, vendor, settings);
assert.equal(calculated.iva16Cents, 1992285);
assert.equal(calculated.islrRetentionCents, 249036);
assert.equal(calculated.netPayableCents, 12202745);
const mixed = calculateDocument({ ...input, base16: 100, base8: 200, islrApplies: false, ivaRetentionRate: 75 }, { ...vendor, ivaRetentionRate: 75 }, settings);
assert.equal(mixed.iva16Cents, 1600);
assert.equal(mixed.iva8Cents, 1600);
assert.equal(mixed.ivaRetentionCents, 2400);
const exempt = calculateDocument({ ...input, exempt: 1000, base16: 0, base8: 0,
  islrApplies: false, ivaRetentionRate: 100, ivaRetentionReason: "" }, vendor, settings);
assert.equal(exempt.ivaRetentionRate, 0);
assert.equal(exempt.ivaRetentionCents, 0);
assert.equal(exempt.ivaRetentionReason, "Operación exenta de IVA");
assert.equal(exempt.totalCents, 100000);
const credit = calculateDocument({ ...input, type: "nota_credito", affectedDocumentId: 1, number: "NC001", base16: 100, islrApplies: false }, vendor, settings);
assert.equal(credit.totalCents, -11600);
assert.equal(credit.ivaRetentionCents, -1600);
const doc = { id: 1, vendorId: 1, ...calculated, status: "issued", ivaCertificateNumber: "20261000000001", islrCertificateNumber: "20261000000001", settingsSnapshot: JSON.stringify(settings), attachmentName: "", attachmentType: "", attachmentSize: 0, createdAt: "", updatedAt: "" } as any;
const exemptDoc = { ...doc, ...exempt, status: "issued", ivaCertificateNumber: "" } as any;
assert.throws(() => ivaTxt([{ document: exemptDoc, vendor }] as any,
  [{ document: exemptDoc, vendor }] as any, settings, "2026-10", 1), /No hay retenciones de IVA/);
const joined = [{ document: doc, vendor }] as any;
const pdf = await makeRetentionPdf("iva", doc, vendor as any, settings);
const islrPdf = await makeRetentionPdf("islr", doc, vendor as any, settings);
const xlsx = makeBookXlsx(joined, "2026-10", 1, settings, joined);
const islrXlsx = makeIslrDataXlsx(joined, "2026-10", settings.companyRif);
const txt = ivaTxt(joined, joined, settings, "2026-10", 1);
const xml = islrXml(joined, joined, settings, "2026-10");
assert.equal(txt.trim().split("\t").length, 16);
assert.match(xml, /<FechaOperacion>15\/10\/2026<\/FechaOperacion>/);
assert.match(xml, /<MontoOperacion>124517\.81<\/MontoOperacion>/);
const creditDoc = { ...doc, ...credit, id: 2, controlNumber: "00-000064", status: "issued", ivaCertificateNumber: "20261000000002" } as any;
const invoiceAndCredit = [{ document: doc, vendor }, { document: creditDoc, vendor }] as any;
const creditTxtRows = ivaTxt(invoiceAndCredit, invoiceAndCredit, settings, "2026-10", 1).trim().split("\r\n");
assert.equal(creditTxtRows.length, 2);
assert.equal(creditTxtRows[1].split("\t")[4], "03");
assert.equal(creditTxtRows[1].split("\t")[8], "116.00");
assert.equal(creditTxtRows[1].split("\t")[10], "16.00");
// La nota del mismo período y quincena conserva el número de su factura afectada.
assert.equal(creditTxtRows[1].split("\t")[11], doc.number);
const crossHalfCredit = { ...creditDoc, id: 3, number: "NC002", period: "2026-10", half: 2,
  issuedAt: "2026-10-16", eventAt: "2026-10-16", ivaCertificateNumber: "20261000000003" } as any;
assert.throws(
  () => ivaTxt([{ document: crossHalfCredit, vendor }] as any,
    [{ document: doc, vendor }, { document: crossHalfCredit, vendor }] as any, settings, "2026-10", 2),
  /otra quincena/,
);
const collidingIslrInvoices = [
  { document: { ...doc, id: 3, number: "A1234567890" }, vendor },
  { document: { ...doc, id: 4, number: "B1234567890" }, vendor },
] as any;
assert.throws(
  () => islrXml(collidingIslrInvoices, collidingIslrInvoices, settings, "2026-10"),
  /coinciden en los últimos diez caracteres \(1234567890\)/,
);
const otherVendor = { ...vendor, id: 2, rif: "J123456789" };
assert.doesNotThrow(() => islrXml(
  [collidingIslrInvoices[0], { document: collidingIslrInvoices[1].document, vendor: otherVendor }] as any,
  [collidingIslrInvoices[0], { document: collidingIslrInvoices[1].document, vendor: otherVendor }] as any,
  settings,
  "2026-10",
));
const mixedDoc = { ...doc, ...mixed, status: "issued", ivaCertificateNumber: "20261000000002" } as any;
assert.throws(() => ivaTxt([{ document: mixedDoc, vendor }] as any, [{ document: mixedDoc, vendor }] as any, settings, "2026-10", 1), /mezclan 16 % y 8 %/);
// Una compra con IVA retenido en 0 % permanece en el libro; no genera línea
// de retención en el TXT. Si es la única compra, el TXT no tiene movimientos.
const zeroDoc = { ...doc, ivaRetentionCents: 0, ivaRetentionRate: 0, ivaCertificateNumber: "", islrApplies: false } as any;
assert.throws(
  () => ivaTxt([{ document: zeroDoc, vendor }] as any, [{ document: zeroDoc, vendor }] as any, settings, "2026-10", 1),
  /No hay retenciones de IVA en esta quincena/,
);
await writeFile(join(tmpdir(), "upco-tax-smoke.pdf"), pdf);
await writeFile(join(tmpdir(), "upco-islr-smoke.pdf"), islrPdf);
await writeFile(join(tmpdir(), "upco-tax-smoke.xlsx"), xlsx);
await writeFile(join(tmpdir(), "upco-islr-smoke.xlsx"), islrXlsx);
console.log(JSON.stringify({ pdfBytes: pdf.length, islrPdfBytes: islrPdf.length, xlsxBytes: xlsx.length, islrXlsxBytes: islrXlsx.length, txtFields: txt.trim().split("\t").length, xmlBytes: xml.length, pdf: join(tmpdir(), "upco-tax-smoke.pdf"), islrPdf: join(tmpdir(), "upco-islr-smoke.pdf"), xlsx: join(tmpdir(), "upco-tax-smoke.xlsx"), islrXlsx: join(tmpdir(), "upco-islr-smoke.xlsx") }));
