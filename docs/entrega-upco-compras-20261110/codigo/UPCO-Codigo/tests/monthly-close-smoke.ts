import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../lib/tax/core";
import { makeMonthlyCloseXlsx, monthlyCloseRows, parseCloseRange } from "../lib/tax/monthlyClose";

const settings = {
  ...DEFAULT_SETTINGS,
  cecos: [{ id: 1, code: "ADM", name: "Administración", active: true }, { id: 2, code: "OPS", name: "Operaciones", active: true }],
  paymentAccounts: [{ id: 1, code: "B01", name: "Banco principal", active: true }],
};
const row = (id: number, status: string, eventAt: string) => ({
  document: {
    id, status, type: "factura", issuedAt: "2026-10-31", eventAt, number: `F-${id}`, controlNumber: `C-${id}`,
    exemptCents: 0, base16Cents: 10001, iva16Cents: 1600, base8Cents: 0, iva8Cents: 0,
    subtotalCents: 10001, totalCents: 11601, netPayableCents: 10551, ivaRetentionCents: 1200,
    igtfBaseCents: 5000, igtfAmountCents: 150,
    islrRetentionCents: 0, ivaCertificateNumber: "IVA-001", islrCertificateNumber: "", paymentAccountId: 1,
    cecoAllocations: JSON.stringify([{ cecoId: 1, percentage: 33.33 }, { cecoId: 2, percentage: 66.67 }]),
    accountingSnapshot: JSON.stringify({ paymentAccount: { code: "B01", name: "Banco principal" }, cecos: [
      { code: "ADM", name: "Administración", percentage: 33.33 }, { code: "OPS", name: "Operaciones", percentage: 66.67 },
    ] }), description: "Compra de papelería & suministros",
  },
  vendor: { rif: "J123456789", name: "PROVEEDOR DE PRUEBA" },
}) as unknown as Parameters<typeof monthlyCloseRows>[0][number];

assert.deepEqual(parseCloseRange(new Request("http://localhost/api?from=2026-11-01&to=2026-11-30")), { from: "2026-11-01", to: "2026-11-30" });
assert.throws(() => parseCloseRange(new Request("http://localhost/api?from=2026-11-30&to=2026-11-01")), /anterior/);
assert.throws(() => parseCloseRange(new Request("http://localhost/api?from=2026-02-30&to=2026-03-01")), /inválida/);

const selected = monthlyCloseRows([
  row(1, "issued", "2026-11-04"), row(2, "draft", "2026-11-04"), row(3, "void", "2026-11-04"), row(4, "issued", "2026-12-01"),
], "2026-11-01", "2026-11-30");
assert.deepEqual(selected.map(item => item.document.id), [1]);
const raw = new TextDecoder().decode(makeMonthlyCloseXlsx(selected, "2026-11-01", "2026-11-30", settings));
assert.match(raw, /CIERRE CONTABLE · DOCUMENTOS/);
assert.match(raw, /CIERRE CONTABLE · DISTRIBUCIÓN POR CECO/);
assert.match(raw, /Fecha de pago o abono: del 01\/11\/2026 al 30\/11\/2026/);
assert.match(raw, /Compra de papelería &amp; suministros/);
assert.match(raw, /ADM Administración 33.33%; OPS Operaciones 66.67%/);
assert.match(raw, /Distribución CECO/);
assert.match(raw, /IGTF 3 % \(Bs\.\)/);
assert.match(raw, /Base IGTF asignada \(Bs\.\)/);
assert.match(raw, /IGTF asignado \(Bs\.\)/);
assert.ok(!raw.includes("F-2"));
assert.ok(!raw.includes("F-3"));
assert.ok(!raw.includes("F-4"));
