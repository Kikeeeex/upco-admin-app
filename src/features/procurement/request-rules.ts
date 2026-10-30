import { z } from "zod";

const quantity = z.string().regex(/^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/)
  .refine((value) => Number(value) > 0);
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined).optional();

const request = z.object({
  title: z.string().trim().min(1).max(200),
  quantity,
  unit: z.string().trim().min(1).max(40),
  siteId: z.uuid(),
  need: z.string().trim().min(1).max(5000),
  reference: optionalText(200),
  vendorId: z.uuid().optional(),
});

export type ProcurementRequestInput = z.infer<typeof request>;
export function parseProcurementRequestInput(value: unknown): ProcurementRequestInput {
  return request.parse(value);
}

export type ProcurementDetail = {
  work_item_id: string; quantity: number; unit: string; need: string;
  reference: string | null; vendor_id: string | null; vendor_name: string | null;
};
