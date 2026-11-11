import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../lib/tax/core";
import { islrXml, type JoinedDocument } from "../lib/tax/exports";

const row = {
  document: {
    status: "issued", type: "factura", eventAt: "2026-11-09",
    number: "000063", controlNumber: "00-63", islrConceptCode: "001",
    islrTaxableBaseCents: 50_000, islrRate: 2,
    islrRetentionCents: 1_000,
  },
  vendor: { rif: "J123456789" },
} as JoinedDocument;

assert.match(islrXml([row], [row], DEFAULT_SETTINGS, "2026-11"), /<MontoOperacion>500\.00<\/MontoOperacion>/);

const inconsistent = {
  ...row,
  document: { ...row.document, islrTaxableBaseCents: 100_000 },
} as JoinedDocument;
assert.throws(
  () => islrXml([inconsistent], [inconsistent], DEFAULT_SETTINGS, "2026-11"),
  /no reproducen el monto retenido/,
);

const precisionMismatch = {
  ...row,
  document: { ...row.document, islrTaxableBaseCents: 100_000, islrRate: 2.345, islrRetentionCents: 2_345 },
} as JoinedDocument;
assert.throws(
  () => islrXml([precisionMismatch], [precisionMismatch], DEFAULT_SETTINGS, "2026-11"),
  /no reproducen el monto retenido/,
);
