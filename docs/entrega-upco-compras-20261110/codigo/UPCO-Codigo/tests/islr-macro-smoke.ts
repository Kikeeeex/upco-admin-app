import { mkdirSync, writeFileSync } from "node:fs";
import { makeIslrDataXlsx } from "../lib/tax/islrXlsx";
import type { JoinedDocument } from "../lib/tax/exports";

const rows = [{
  document: {
    number: "63", controlNumber: "ZZP0001521", eventAt: "2026-10-01",
    islrConceptCode: "055", islrTaxableBaseCents: 123456, islrRate: 2,
  },
  vendor: { rif: "J123456789" },
}] as JoinedDocument[];

mkdirSync(".test-data", { recursive: true });
writeFileSync(".test-data/islr-macro-smoke.xlsx", makeIslrDataXlsx(rows, "2026-10", "J308175390"));
