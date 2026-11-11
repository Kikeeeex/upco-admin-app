import assert from "node:assert/strict";
import { fiscalMachineNumbers, vendorReviewText } from "../lib/tax/vendorPresentation.ts";

const imported = JSON.stringify({
  taxpayerType: "No consta en comprobantes; valor inicial por revisar",
  personType: "Inferido por primera letra del RIF",
});
const display = vendorReviewText(imported);
assert.match(display, /Tipo de contribuyente: No consta/);
assert.match(display, /Tipo de persona: Inferido/);
assert.equal(typeof display, "string");
assert.equal(vendorReviewText("{}"), "");
assert.equal(vendorReviewText("Texto anterior"), "Texto anterior");
assert.equal(vendorReviewText(JSON.stringify("Pendiente de revisión")), "Pendiente de revisión");
assert.deepEqual(fiscalMachineNumbers('[" Z1-001 ","Z1-002",null,3]'), ["Z1-001", "Z1-002"]);
assert.deepEqual(fiscalMachineNumbers("{malformado"), []);
console.log("Proveedor importado: notas de revisión y máquinas fiscales legibles.");
