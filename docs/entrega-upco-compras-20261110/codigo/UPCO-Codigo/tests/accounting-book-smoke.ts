import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SETTINGS } from "../lib/tax/core";
import { makeBookXlsx } from "../lib/tax/xlsx";

const settings = {
  ...DEFAULT_SETTINGS,
  cecos: [
    { id: 1, code: "ADM", name: "Administración", active: true },
    { id: 2, code: "OPS", name: "Operaciones", active: true },
  ],
  paymentAccounts: [{ id: 1, code: "B01", name: "Banco principal", active: true }],
};
const invoice = {
  id: 1, vendorId: 1, type: "factura", issuedAt: "2026-11-06", eventAt: "2026-11-06",
  number: "F-1", controlNumber: "00-1", affectedDocumentId: null,
  exemptCents: 0, base16Cents: 10000, base8Cents: 0, iva16Cents: 1600, iva8Cents: 0,
  subtotalCents: 10000, totalCents: 11600, ivaRetentionCents: 1200,
  ivaCertificateNumber: "20261100000001", ceco: "ADM 33.33%; OPS 66.67%",
  cecoAllocations: JSON.stringify([{ cecoId: 1, percentage: 33.33 }, { cecoId: 2, percentage: 66.67 }]),
  paymentAccountId: 1, accountingSnapshot: JSON.stringify({
    description: "Servicios de mantenimiento del equipo principal",
    cecos: [
      { id: 1, code: "ADM", name: "Administración", percentage: 33.33 },
      { id: 2, code: "OPS", name: "Operaciones", percentage: 66.67 },
    ],
    paymentAccount: { id: 1, code: "B01", name: "Banco principal" },
  }),
  description: "Servicios de mantenimiento del equipo principal",
} as any;
const vendor = { id: 1, rif: "J123456789", name: "PROVEEDOR DE PRUEBA", taxpayerType: "ordinario" } as any;
const path = join(tmpdir(), "upco-accounting-book-smoke.xlsx");
writeFileSync(path, makeBookXlsx([{ document: invoice, vendor }], "2026-11", 1, settings));
console.log(path);
