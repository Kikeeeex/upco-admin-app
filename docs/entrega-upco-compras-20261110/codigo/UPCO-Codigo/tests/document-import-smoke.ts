import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../lib/tax/core";
import { inspectRows } from "../lib/tax/importDocumentPreview";
import { IMPORT_HEADERS, makeImportTemplateXlsx, readImportSpreadsheet } from "../lib/tax/importSpreadsheet";
import { zipStore } from "../lib/tax/xlsx";

const template = makeImportTemplateXlsx();
assert.ok(new TextDecoder().decode(template).includes("RIF proveedor"));
assert.deepEqual(readImportSpreadsheet(template, "plantilla.xlsx"), []);

const values = ["J123456789", "factura", "2026-11-08", "2026-11-09", "2026-11", "1", "F-63", "00-63", "", "0,00", "100,00", "0,00", "75", "12,00", "20261100000001", "", "", "", "", "", "Compra de papelería", "B01", "ADM:100", "No", "0,00", "", ""];
const csv = [IMPORT_HEADERS.join(";"), values.join(";")].join("\r\n");
const parsed = readImportSpreadsheet(new TextEncoder().encode(csv), "historico.csv");
assert.equal(parsed.length, 1);
assert.equal(parsed[0].cells[6], "F-63");

const settings = { ...DEFAULT_SETTINGS,
  cecos: [{ id: 1, code: "ADM", name: "Administración", active: true }],
  paymentAccounts: [{ id: 1, code: "B01", name: "Banco principal", active: true }],
};
const vendor = { id: 1, rif: "J123456789", name: "PROVEEDOR", taxpayerType: "ordinario", personType: "juridica", residency: "domiciliada", ivaRetentionRate: 75, active: true, needsReview: true } as unknown as Parameters<typeof inspectRows>[1][number];
const preview = inspectRows(parsed, [vendor], [], settings);
assert.deepEqual(preview.summary, { total: 1, ready: 1, blocked: 0 });
assert.equal(preview.rows[0].values.rif, "J123456789");
assert.ok(preview.rows[0].warnings.some(value => value.includes("pendiente de verificación")));
assert.equal(preview.prepared[0].ivaCertificate, "20261100000001");

const duplicate = inspectRows(parsed, [vendor], [{ id: 4, vendorId: 1, type: "factura", number: "F-63", status: "issued", ivaCertificateNumber: "", islrCertificateNumber: "" } as unknown as Parameters<typeof inspectRows>[2][number]], settings);
assert.equal(duplicate.summary.blocked, 1);
assert.ok(duplicate.rows[0].issues.some(value => value.includes("duplicado")));

const note = [...values]; note[1] = "nota_credito"; note[6] = "NC-1"; note[8] = "F-63"; note[14] = "20261100000002";
const noteRows = readImportSpreadsheet(new TextEncoder().encode([IMPORT_HEADERS.join(";"), note.join(";")].join("\r\n")), "nota.csv");
const notePreview = inspectRows(noteRows, [vendor], [{ id: 4, vendorId: 1, type: "factura", number: "F-63", status: "issued", ivaCertificateNumber: "20261100000001", islrCertificateNumber: "" } as unknown as Parameters<typeof inspectRows>[2][number]], settings);
assert.deepEqual(notePreview.summary, { total: 1, ready: 1, blocked: 0 });
assert.equal(notePreview.prepared[0].values.ivaRetentionCents, -1200);

const partial = [...values]; partial[6] = "F-64"; partial[7] = "00-64"; partial[15] = "004"; partial[16] = "100,00"; partial[17] = "5"; partial[18] = "1,50"; partial[19] = "20261100000001"; partial[25] = "40,00"; partial[26] = "0,50";
const partialRows = readImportSpreadsheet(new TextEncoder().encode([IMPORT_HEADERS.join(";"), partial.join(";")].join("\r\n")), "parcial.csv");
const partialPreview = inspectRows(partialRows, [vendor], [], settings);
assert.deepEqual(partialPreview.summary, { total: 1, ready: 1, blocked: 0 });
assert.equal(partialPreview.prepared[0].values.islrBaseCents, 10000);
assert.equal(partialPreview.prepared[0].values.islrTaxableBaseCents, 4000);
assert.equal(partialPreview.prepared[0].values.islrSubtractionCents, 50);
assert.equal(partialPreview.prepared[0].values.islrRetentionCents, 150);
const excessive = [...partial]; excessive[25] = "101,00";
assert.equal(inspectRows(readImportSpreadsheet(new TextEncoder().encode([IMPORT_HEADERS.join(";"), excessive.join(";")].join("\r\n")), "excesiva.csv"), [vendor], [], settings).summary.blocked, 1);
const historicalDifference = [...partial]; historicalDifference[18] = "1,40";
const differencePreview = inspectRows(readImportSpreadsheet(new TextEncoder().encode([IMPORT_HEADERS.join(";"), historicalDifference.join(";")].join("\r\n")), "diferencia.csv"), [vendor], [], settings);
assert.equal(differencePreview.summary.ready, 1);
assert.ok(differencePreview.rows[0].warnings.some(value => value.includes("Monto ISLR difiere")));

const shared = `<sst><si><t>${IMPORT_HEADERS[0]}</t></si></sst>`;
const cells = IMPORT_HEADERS.map((value, i) => `<c r="${i < 26 ? String.fromCharCode(65 + i) : "AA"}1" t="inlineStr"><is><t>${value}</t></is></c>`).join("");
const formula = zipStore({ "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="1">${cells}</row><row r="2"><c r="A2"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>`, "xl/sharedStrings.xml": shared });
assert.throws(() => readImportSpreadsheet(formula, "formulas.xlsx"), /fórmulas/);
