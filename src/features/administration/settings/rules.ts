import { z } from "zod";

const boundedRate = z.string().trim().regex(/^\d{1,3}(?:[.,]\d{1,4})?$/)
  .transform((value) => Number(value.replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value >= 0 && value <= 100);
const positiveAmount = z.string().trim().regex(/^\d{1,12}(?:[.,]\d{1,4})?$/)
  .transform((value) => Number(value.replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value > 0);

function parseJsonList(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(value); }
  catch { throw new Error(`${label} debe ser JSON válido.`); }
  if (!Array.isArray(parsed) || parsed.length > 100 || parsed.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error(`${label} debe ser una lista de hasta 100 objetos.`);
  }
  return parsed as Record<string, unknown>[];
}

function parseJsonObject(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(value); }
  catch { throw new Error(`${label} debe ser JSON válido.`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} debe ser un objeto JSON.`);
  }
  return parsed as Record<string, unknown>;
}

const base = z.object({
  proposalLabel: z.string().trim().min(2).max(160),
  companyName: z.string().trim().min(2).max(200),
  companyRif: z.string().trim().min(3).max(40),
  companyAddress: z.string().trim().min(5).max(1000),
  utAmount: positiveAmount,
  utEffectiveFrom: z.iso.date(),
  ivaGeneralRate: boundedRate,
  ivaReducedRate: boundedRate,
  ivaAdditionalRates: z.string().trim().max(30000),
  igtfReference: z.string().trim().max(10000),
  islrCatalogueReference: z.string().trim().max(10000),
});

export type FiscalSettingsProposalInput = Omit<z.infer<typeof base>, "ivaAdditionalRates" | "igtfReference" | "islrCatalogueReference"> & {
  islrConcepts: Record<string, unknown>[];
  cecos: Record<string, unknown>[];
  paymentAccounts: Record<string, unknown>[];
  sequences: Record<string, unknown>[];
  ivaAdditionalRates: Record<string, unknown>[];
  igtfReference: Record<string, unknown>;
  islrCatalogueReference: Record<string, unknown>;
};

export function parseFiscalSettingsProposal(value: unknown): FiscalSettingsProposalInput {
  if (!value || typeof value !== "object") throw new Error("Propuesta inválida.");
  const form = value as Record<string, unknown>;
  const parsed = base.parse(form);
  return {
    ...parsed,
    islrConcepts: parseJsonList(form.islrConcepts, "Conceptos ISLR"),
    cecos: parseJsonList(form.cecos, "CECO"),
    paymentAccounts: parseJsonList(form.paymentAccounts, "Cuentas de pago"),
    sequences: parseJsonList(form.sequences, "Correlativos"),
    ivaAdditionalRates: parseJsonList(parsed.ivaAdditionalRates, "Referencias de alícuotas IVA adicionales"),
    igtfReference: parseJsonObject(parsed.igtfReference, "Referencia IGTF"),
    islrCatalogueReference: parseJsonObject(parsed.islrCatalogueReference, "Referencia del catálogo ISLR"),
  };
}
