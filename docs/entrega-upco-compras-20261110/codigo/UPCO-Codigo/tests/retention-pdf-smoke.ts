import { mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { DEFAULT_SETTINGS } from "../lib/tax/core";
import { makeCombinedRetentionPdf, makeRetentionPdf } from "../lib/tax/pdf";

const document = {
  type: "factura", number: "63", controlNumber: "ZZP0001521",
  issuedAt: "2026-11-01", eventAt: "2026-11-01", period: "2026-12", half: 1,
  ivaCertificateNumber: "20261200000001", islrCertificateNumber: "20261100000001",
  base16Cents: 10000, iva16Cents: 1600, base8Cents: 0, iva8Cents: 0,
  exemptCents: 0, subtotalCents: 10000, totalCents: 11600,
  ivaRetentionRate: 75, ivaRetentionCents: 1200,
  islrConceptCode: "055", islrBaseCents: 10000, islrRate: 2,
  islrSubtractionCents: 0, islrRetentionCents: 200,
  islrManual: false, islrManualReason: "", netPayableCents: 10200,
  ceco: "ADM 100%", description: "Servicio de mantenimiento del equipo",
} as any;
const vendor = {
  name: "PROVEEDOR DE PRUEBA", rif: "J123456789",
  personType: "juridica", residency: "domiciliada",
  address: "Maracaibo",
} as any;
mkdirSync(".test-data", { recursive: true });
for (const kind of ["iva", "islr"] as const) {
  writeFileSync(`.test-data/retention-${kind}-smoke.pdf`, await makeRetentionPdf(kind, document, vendor, DEFAULT_SETTINGS));
}
const combined = await makeCombinedRetentionPdf(document, vendor, DEFAULT_SETTINGS);
if ((await PDFDocument.load(combined)).getPageCount() !== 2) throw new Error("El PDF conjunto debe contener los dos comprobantes");
writeFileSync(".test-data/retention-combined-smoke.pdf", combined);
