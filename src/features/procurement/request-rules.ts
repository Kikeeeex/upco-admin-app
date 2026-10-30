import { z } from "zod";

const quantity = z.string().regex(/^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/)
  .refine((value) => Number(value) > 0);
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined).optional();
const requester = z.object({
  requesterFirstName: z.string().trim().min(1).max(100),
  requesterLastName: z.string().trim().min(1).max(100),
  requesterArea: z.enum(["siaho", "products_services", "operations", "administration", "finance", "it"]),
});
const lineItem = z.object({
  article: z.string().trim().min(1).max(200),
  partNumber: optionalText(120),
  quantity,
  unit: z.string().trim().min(1).max(40),
});

const request = requester.extend({
  items: z.array(lineItem).min(1).max(50),
  siteId: z.uuid(),
  need: z.string().trim().min(1).max(5000),
  reference: optionalText(200),
  vendorId: z.uuid().optional(),
});

export type ProcurementRequestInput = z.infer<typeof request>;
export function parseProcurementRequestInput(value: unknown): ProcurementRequestInput {
  return request.parse(value);
}

const requesterUpdate = requester.extend({ id: z.uuid(), partNumber: optionalText(120) });
export type ProcurementRequesterUpdate = z.infer<typeof requesterUpdate>;
export function parseProcurementRequesterUpdate(value: unknown): ProcurementRequesterUpdate {
  return requesterUpdate.parse(value);
}

export type ProcurementLineItem = {
  id: string; work_item_id: string; position: number; article: string;
  part_number: string | null; quantity: number; unit: string;
};

export type ProcurementDetail = {
  work_item_id: string; quantity: number; unit: string; need: string;
  reference: string | null; vendor_id: string | null; vendor_name: string | null;
  part_number: string | null; requester_first_name: string | null;
  requester_last_name: string | null; requester_area: ProcurementRequestInput["requesterArea"] | null;
  item_count: number;
};
