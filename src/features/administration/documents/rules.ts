import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined).optional();
const date = z.union([z.literal(""), z.iso.date()]).optional().transform((value) => value || undefined);
const period = z.union([z.literal(""), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)]).optional().transform((value) => value || undefined);
const half = z.union([z.literal(""), z.enum(["1", "2"])]).optional().transform((value) => value ? Number(value) as 1 | 2 : undefined);
const amount = z.string().trim().optional().transform((value) => value || "0")
  .refine((value) => /^\d{1,12}(?:[.,]\d{1,2})?$/.test(value), { message: "Monto inválido" })
  .transform((value) => {
    const [whole, fraction = ""] = value.replace(",", ".").split(".");
    return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  });

const optionalPercent = z.union([z.literal(""), z.string().trim().regex(/^\d{1,3}(?:[.,]\d{1,2})?$/)]).optional()
  .transform((value) => value === "" || value === undefined ? undefined : Number(value.replace(",", ".")))
  .refine((value) => value === undefined || (Number.isFinite(value) && value >= 0 && value <= 100), { message: "Porcentaje inválido" });

const draft = z.object({
  fiscalVendorId: z.union([z.literal(""), z.uuid()]).optional().transform((value) => value || undefined),
  documentType: z.enum(["invoice", "credit_note", "debit_note"]),
  invoiceNumber: optionalText(80),
  controlNumber: optionalText(80),
  issuedAt: date,
  eventAt: date,
  taxPeriod: period,
  taxHalf: half,
  periodOverrideReason: optionalText(1000),
  affectedDocumentId: z.union([z.literal(""), z.uuid()]).optional().transform((value) => value || undefined),
  description: z.string().trim().min(10).max(2000),
  exempt: amount,
  base16: amount,
  base8: amount,
  ivaRetentionRate: z.union([z.literal(""), z.enum(["0", "75", "100"])]).optional().transform((value) => value ? Number(value) as 0 | 75 | 100 : undefined),
  ivaRetentionReason: optionalText(1000),
  igtfApplies: z.boolean(),
  igtfBase: amount,
  islrApplies: z.boolean(),
  islrConceptCode: optionalText(80),
  islrBase: amount,
  islrManual: z.union([z.literal(""), amount]).optional().transform((value) => value === "" || value === undefined ? undefined : value),
  islrRate: optionalPercent,
  islrSubtraction: amount,
  islrManualReason: optionalText(1000),
  paymentAccountLabel: optionalText(200),
  cecoAllocationNote: optionalText(2000),
}).superRefine((value, context) => {
  if (value.taxHalf && !value.taxPeriod) context.addIssue({ code: "custom", path: ["taxPeriod"], message: "Indica el período si seleccionas una quincena." });
  if (value.islrApplies && value.islrManual !== undefined && !value.islrManualReason) context.addIssue({ code: "custom", path: ["islrManualReason"], message: "Indica el motivo del monto ISLR manual." });
  if (value.islrApplies && value.islrManual !== undefined && value.islrRate === undefined) context.addIssue({ code: "custom", path: ["islrRate"], message: "Indica la alícuota usada para el cálculo manual de ISLR." });
  if (value.ivaRetentionRate === 100 && !value.ivaRetentionReason) context.addIssue({ code: "custom", path: ["ivaRetentionReason"], message: "Indica la causal de retención del 100 % de IVA." });
  if (value.islrApplies && !value.islrConceptCode && value.islrManual === undefined) context.addIssue({ code: "custom", path: ["islrConceptCode"], message: "Indica un concepto ISLR o un monto manual documentado." });
  if (!value.islrApplies && (value.islrConceptCode || value.islrManual !== undefined)) context.addIssue({ code: "custom", path: ["islrApplies"], message: "Marca que aplica ISLR para guardar un concepto o monto ISLR." });
  if (value.cecoAllocationNote) {
    const allocations = value.cecoAllocationNote.split(";").map((entry) => entry.trim());
    const parsed = allocations.map((entry) => {
      const match = entry.match(/^([A-Za-z0-9._-]{1,80}):([0-9]+(?:[.,][0-9]{1,2})?)$/);
      if (!match) return null;
      const [whole, fraction = ""] = match[2].replace(",", ".").split(".");
      return { code: match[1].toUpperCase(), basisPoints: Number(whole) * 100 + Number((fraction + "00").slice(0, 2)) };
    });
    if (parsed.some((allocation) => allocation === null)) {
      context.addIssue({ code: "custom", path: ["cecoAllocationNote"], message: "Usa el formato CODIGO:PORCENTAJE;CODIGO:PORCENTAJE, por ejemplo ADM:60;OPS:40." });
    } else {
      const allocations = parsed.filter((allocation): allocation is NonNullable<typeof allocation> => allocation !== null);
      if (allocations.some((allocation) => allocation.basisPoints <= 0)) context.addIssue({ code: "custom", path: ["cecoAllocationNote"], message: "Cada porcentaje CECO debe ser mayor que 0." });
      if (new Set(allocations.map((allocation) => allocation.code)).size !== allocations.length) context.addIssue({ code: "custom", path: ["cecoAllocationNote"], message: "No repitas códigos CECO en la distribución." });
      if (allocations.reduce((total, allocation) => total + allocation.basisPoints, 0) !== 10000) context.addIssue({ code: "custom", path: ["cecoAllocationNote"], message: "La distribución CECO debe sumar exactamente 100 %." });
    }
  }
});

export type AdministrationDraftInput = z.infer<typeof draft>;
export function parseAdministrationDraft(value: unknown): AdministrationDraftInput { return draft.parse(value); }
