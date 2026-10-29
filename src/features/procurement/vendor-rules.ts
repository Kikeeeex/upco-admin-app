import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined).optional();
const optionalEmail = z.string().trim().max(254).transform((value) => value || undefined)
  .refine((value) => !value || z.email().safeParse(value).success, { message: "Correo no válido." }).optional();

const vendor = z.object({
  name: z.string().trim().min(1).max(200).transform((value) => value.replace(/\s+/g, " ")),
  contactName: optionalText(200),
  email: optionalEmail,
  phone: optionalText(60),
  notes: optionalText(2000),
});

export type VendorInput = z.infer<typeof vendor>;
export type VendorUpdate = VendorInput & { id: string };
export function parseVendorInput(value: unknown): VendorInput { return vendor.parse(value); }
export function parseVendorUpdate(value: unknown): VendorUpdate { return vendor.extend({ id: z.uuid() }).parse(value); }

export type VendorRow = {
  id: string; name: string; contact_name: string | null; email: string | null; phone: string | null;
  notes: string | null; created_by: string; created_at: string; updated_at: string;
};
