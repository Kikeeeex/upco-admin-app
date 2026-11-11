import assert from "node:assert/strict";
import { calculateDocument, DEFAULT_SETTINGS } from "../lib/tax/core";

const vendor = { rif: "J407117998", name: "Proveedor de prueba", taxpayerType: "ordinario" as const,
  personType: "juridica" as const, residency: "domiciliada" as const, ivaRetentionRate: 100 as const };
const settings = { ...DEFAULT_SETTINGS,
  cecos: [{ id: 1, code: "ADM", name: "Administración", active: true }],
  paymentAccounts: [{ id: 1, code: "BANCO", name: "Cuenta de prueba", active: true }],
};
const input = { type: "factura", issuedAt: "2026-10-31", eventAt: "2026-11-09", period: "2026-11", half: 1 as const,
  number: "F-IGTF", controlNumber: "C-IGTF", exempt: 0, base16: 100, base8: 0,
  ivaRetentionRate: 100, ivaRetentionReason: "Proveedor sujeto a retención completa", islrApplies: false,
  igtfApplies: true, igtfBase: 58.50, description: "Compra parcialmente pagada en divisas",
  paymentAccountId: 1, cecoAllocations: [{ cecoId: 1, percentage: 100 }],
};

const invoice = calculateDocument(input, vendor, settings);
assert.equal(invoice.totalCents, 11600); // El libro de IVA conserva el total de compra sin IGTF.
assert.equal(invoice.igtfBaseCents, 5850);
assert.equal(invoice.igtfAmountCents, 176); // 3 % redondeado al céntimo.
assert.equal(invoice.netPayableCents, 10176); // 116,00 + 1,76 - 16,00 de IVA retenido.
assert.throws(() => calculateDocument({ ...input, igtfBase: 0 }, vendor, settings), /base imponible IGTF mayor que cero/);

const withoutIgtf = calculateDocument({ ...input, igtfApplies: false }, vendor, settings);
assert.equal(withoutIgtf.igtfBaseCents, 0);
assert.equal(withoutIgtf.igtfAmountCents, 0);
assert.equal(withoutIgtf.netPayableCents, 10000);

const credit = calculateDocument({ ...input, type: "nota_credito", number: "NC-IGTF", affectedDocumentId: 1 }, vendor, settings);
assert.equal(credit.igtfBaseCents, -5850);
assert.equal(credit.igtfAmountCents, -176);
assert.equal(credit.netPayableCents, -10176);
