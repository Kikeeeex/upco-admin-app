import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined).optional();
const optionalEmail = z.string().trim().max(254).transform((value) => value || undefined)
  .refine((value) => !value || z.email().safeParse(value).success, { message: "Correo no válido." }).optional();
const legacyVendorAreas = ["siaho", "products_services", "operations", "administration", "finance", "it"] as const;
export type LegacyVendorArea = typeof legacyVendorAreas[number];

const vendor = z.object({
  name: z.string().trim().min(1).max(200).transform((value) => value.replace(/\s+/g, " ")),
  country: optionalText(100),
  taxIdentifier: optionalText(100),
  salesArea: optionalText(200),
  contactPerson: optionalText(200),
  website: optionalText(500),
  city: optionalText(150),
  productsServicesDetail: z.string().trim().transform((value) => value || undefined).optional(),
  email: optionalEmail,
  phone: optionalText(60),
  associatedArea: z.enum(legacyVendorAreas).optional(),
});

export type VendorInput = z.infer<typeof vendor>;
export type VendorUpdate = VendorInput & { id: string };
export function parseVendorInput(value: unknown): VendorInput { return vendor.parse(value); }
export function parseVendorUpdate(value: unknown): VendorUpdate { return vendor.extend({ id: z.uuid() }).parse(value); }

export type VendorRow = {
  id: string; name: string; country: string | null; tax_identifier: string | null;
  contact_name: string | null; email: string | null; phone: string | null; sales_area: string | null;
  website: string | null; city: string | null; products_services_detail: string | null;
  notes: string | null; associated_area: LegacyVendorArea | null;
  archived_at: string | null; created_by: string; created_at: string; updated_at: string;
};

export const vendorAreaLabels: Record<LegacyVendorArea, string> = {
  siaho: "SIAHO", products_services: "Productos y Servicios", operations: "Operaciones",
  administration: "Administración", finance: "Finanzas", it: "TI",
};

export function vendorAreaLabel(area: VendorRow["associated_area"]): string {
  return area ? vendorAreaLabels[area] : "Sin asignar";
}

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export function vendorArchiveCutoff(now = new Date()): string {
  return new Date(now.getTime() - RETENTION_MS).toISOString();
}
export function vendorArchiveExpiry(archivedAt: string): string {
  return new Date(new Date(archivedAt).getTime() + RETENTION_MS).toISOString();
}

type RawFilter = string | string[] | undefined;
export type VendorFilters = { query: string; country: string; salesArea: string };
export function parseVendorFilters(raw: { buscarProveedor?: RawFilter; pais?: RawFilter; areaVenta?: RawFilter }): VendorFilters {
  const value = (input: RawFilter, max: number) => typeof input === "string" && input.trim().length <= max && !input.includes("*") ? input.trim() : "";
  return { query: value(raw.buscarProveedor, 100), country: value(raw.pais, 100), salesArea: value(raw.areaVenta, 200) };
}

export function vendorListHref(filters: VendorFilters, page: number, archivePage = 1): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("buscarProveedor", filters.query);
  if (filters.country) params.set("pais", filters.country);
  if (filters.salesArea) params.set("areaVenta", filters.salesArea);
  params.set("pagina", String(page));
  if (archivePage > 1) params.set("archivoPagina", String(archivePage));
  return `/procura?${params.toString()}#proveedores`;
}

export function safeVendorWebsiteUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password && url.hostname.includes(".") ? url.href : null;
  } catch { return null; }
}
