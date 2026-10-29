import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined).optional();
function isHttpUrl(value: string | undefined) {
  if (!value) return true;
  try { return /^https?:$/.test(new URL(value).protocol); }
  catch { return false; }
}
const documentUrl = z.string().trim().max(2000).transform((value) => value || undefined)
  .refine(isHttpUrl, { message: "El enlace debe usar HTTP o HTTPS." })
  .optional();

const details = z.object({
  procedureType: z.string().trim().min(1).max(120),
  counterpartName: z.string().trim().min(1).max(200),
  reference: optionalText(200),
  documentStatus: z.enum(["pending", "received", "reviewed"]),
  documentReference: optionalText(200),
  documentUrl,
});

const matter = details.extend({
  title: z.string().trim().min(1).max(200),
  commitmentDate: z.iso.date().optional(),
  description: optionalText(5000),
  siteId: z.uuid().optional(),
});

export type AdminMatterInput = z.infer<typeof matter>;
export type AdminDetailsUpdate = z.infer<typeof details> & { id: string };

export function parseAdminMatterInput(value: unknown): AdminMatterInput {
  return matter.parse(value);
}

export function parseAdminDetailsUpdate(value: unknown): AdminDetailsUpdate {
  return details.extend({ id: z.uuid() }).parse(value);
}
