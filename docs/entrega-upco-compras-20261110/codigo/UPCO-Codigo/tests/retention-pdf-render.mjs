import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const generated = path.join(root, ".test-data", "pdf-render");
mkdirSync(generated, { recursive: true });
for (const name of ["islrConcepts", "core", "pdf"]) {
  const source = readFileSync(path.join(root, "lib", "tax", name + ".ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll('from "./core"', 'from "./core.mjs"').replaceAll('from "./islrConcepts"', 'from "./islrConcepts.mjs"');
  writeFileSync(path.join(generated, name + ".mjs"), compiled);
}
const { makeRetentionPdf } = await import(pathToFileURL(path.join(generated, "pdf.mjs")).href);
const { DEFAULT_SETTINGS } = await import(pathToFileURL(path.join(generated, "core.mjs")).href);
const document = {
  type: "factura", number: "000063", controlNumber: "00-000063",
  issuedAt: "2026-09-29", eventAt: "2026-10-15", period: "2026-10", half: 1,
  ivaCertificateNumber: "20261000002240", islrCertificateNumber: "20261000000912",
  base16Cents: 12451781, iva16Cents: 1992285, base8Cents: 0, iva8Cents: 0,
  exemptCents: 0, subtotalCents: 12451781, totalCents: 14444066,
  ivaRetentionRate: 100, ivaRetentionCents: 1992285,
  islrConceptCode: "055", islrBaseCents: 12451781, islrRate: 2,
  islrSubtractionCents: 0, islrRetentionCents: 249036,
  description: "Servicios de consultoría", affectedDocumentId: null,
};
const vendor = {
  name: "PROVEEDOR DE DEMOSTRACIÓN, C.A.", rif: "J123456789",
  personType: "juridica", residency: "domiciliada", phone: "",
  address: "AV. PRINCIPAL, EDIFICIO DE DEMOSTRACIÓN, MARACAIBO",
};
for (const kind of ["iva", "islr"]) {
  const result = await makeRetentionPdf(kind, document, vendor, DEFAULT_SETTINGS);
  writeFileSync(path.join(generated, "retention-" + kind + ".pdf"), result);
}
console.log("PDFs de prueba en " + generated);
