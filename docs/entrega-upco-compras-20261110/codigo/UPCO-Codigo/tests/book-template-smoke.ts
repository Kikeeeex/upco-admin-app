import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../lib/tax/core";
import { makeBookXlsx } from "../lib/tax/xlsx";

const row = {
  document: {
    id: 1, vendorId: 1, type: "factura", status: "issued", issuedAt: "2028-02-16", eventAt: "2028-02-16",
    number: "63", controlNumber: "MF-001", ivaCertificateNumber: "20280200000001",
    exemptCents: 1000, base16Cents: 10000, iva16Cents: 1600, base8Cents: 2000, iva8Cents: 160,
    subtotalCents: 13000, totalCents: 14760, ivaRetentionCents: 1320, affectedDocumentId: null,
    cecoAllocations: "[]", accountingSnapshot: "", paymentAccountId: null,
    description: "Materiales para oficina",
  },
  vendor: { rif: "J123456789", name: "PROVEEDOR DE PRUEBA", taxpayerType: "ordinario" },
} as unknown as Parameters<typeof makeBookXlsx>[0][number];

for (const [half, title, base16, base8, retained] of [
  [1, "Del 01 al 15 de febrero del 2028", "S9", "V9", "Y9"],
  [2, "Del 16 al 29 de febrero del 2028", "T9", "W9", "Z9"],
  [undefined, "Del 01 al 29 de febrero del 2028", "T9", "W9", "Z9"],
] as const) {
  const raw = new TextDecoder().decode(makeBookXlsx([row], "2028-02", half, DEFAULT_SETTINGS));
  assert.ok(raw.includes(title));
  assert.ok(raw.includes(`r="${base16}" s="20"><v>100</v>`));
  assert.ok(raw.includes(`r="${base8}" s="20"><v>20</v>`));
  assert.ok(raw.includes(`r="${retained}" s="20"><v>13.2</v>`));
  assert.ok(raw.includes("Créditos Fiscales en Bolívar"));
  assert.ok(raw.includes('name="_xlnm.Print_Titles"'));
  assert.ok(!/DISTRIBUCIONES 88|LABORATORIO FISA|GFN PC-1/.test(raw));
}
