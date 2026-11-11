import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || undefined).optional();

const fiscalVendorFields = z.object({
  legalName: z.string().trim().min(2).max(200),
  taxIdentifier: z.string().trim().min(3).max(40).transform((value) => value.toUpperCase()),
  taxAddress: z.string().trim().min(5).max(1000),
  taxpayerType: optionalText(120),
  personType: z.enum(["natural", "legal"]),
  residency: optionalText(80),
  contactName: optionalText(200),
  contactPhone: optionalText(80),
  contactEmail: z.union([z.literal(""), z.email()]).optional().transform((value) => value || undefined),
  ivaRetentionRate: z.coerce.number().refine((value) => [0, 75, 100].includes(value)),
  fiscalMachineNumbers: optionalText(2000),
  active: z.boolean(),
  reviewState: z.enum(["needs_review", "confirmed"]),
  reviewNotes: optionalText(2000),
});

export type FiscalVendorInput = z.infer<typeof fiscalVendorFields>;
export type FiscalVendorUpdate = FiscalVendorInput & { id: string };

export function parseFiscalVendorInput(value: unknown): FiscalVendorInput {
  return fiscalVendorFields.parse(value);
}

export function parseFiscalVendorUpdate(value: unknown): FiscalVendorUpdate {
  return fiscalVendorFields.extend({ id: z.uuid() }).parse(value);
}

export function normalizeTaxIdentifier(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
