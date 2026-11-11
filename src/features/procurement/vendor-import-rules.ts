import type { MappedVendorRow, VendorImportField } from "./vendor-import-parser";

export type ExistingVendorIdentity = { id: string; name: string; country: string | null; tax_identifier: string | null;
  archived_at: string | null; created_by: string };
export type VendorPreviewRow = MappedVendorRow & { status: "new" | "match" | "review" | "duplicate_file" | "error";
  matchedVendorId?: string; reason?: string };

const normalized = (value?: string | null) => (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
const taxKey = (value?: string | null) => (value ?? "").replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("es");
const similarKey = (value: string) => normalized(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const key = (...parts: string[]) => parts.join("\u0000");

function add<K, V>(map: Map<K, V[]>, index: K, value: V) {
  const found = map.get(index);
  if (found) found.push(value);
  else map.set(index, [value]);
}

export function analyzeVendorRows(rows: MappedVendorRow[], existing: ExistingVendorIdentity[]): VendorPreviewRow[] {
  const byTax = new Map<string, ExistingVendorIdentity[]>();
  const byNameCountry = new Map<string, ExistingVendorIdentity[]>();
  const byName = new Map<string, ExistingVendorIdentity[]>();
  const similar = new Map<string, ExistingVendorIdentity[]>();
  for (const vendor of existing) {
    const country = normalized(vendor.country);
    const name = normalized(vendor.name);
    const slug = similarKey(vendor.name).slice(0, 3);
    add(byNameCountry, key(name, country), vendor);
    add(byName, name, vendor);
    if (country && taxKey(vendor.tax_identifier)) add(byTax, key(country, taxKey(vendor.tax_identifier)), vendor);
    add(similar, key(country, slug), vendor);
    add(similar, key("*", slug), vendor);
  }
  const seenTax = new Set<string>();
  const seenNameCountry = new Set<string>();
  const result: VendorPreviewRow[] = [];
  for (const item of rows) {
    if (!item.data || item.errors.length) { result.push({ ...item, status: "error" }); continue; }
    const data = item.data;
    const country = normalized(data.country);
    const name = normalized(data.name);
    const tax = taxKey(data.taxIdentifier);
    const nameCountry = key(name, country);
    const fiscal = country && tax ? key(country, tax) : "";
    if ((fiscal && seenTax.has(fiscal)) || seenNameCountry.has(nameCountry)) {
      result.push({ ...item, status: "duplicate_file", reason: "Coincidencia dentro del archivo; esta fila se omitirá." });
      continue;
    }
    if (fiscal) seenTax.add(fiscal);
    seenNameCountry.add(nameCountry);
    const matches = fiscal ? (byTax.get(fiscal) ?? []) : country ? (byNameCountry.get(nameCountry) ?? []) : [];
    if (matches.length === 1 && !matches[0].archived_at) {
      result.push({ ...item, status: "match", matchedVendorId: matches[0].id, reason: "Proveedor existente; se omitirá salvo actualización seleccionada." });
      continue;
    }
    if (matches.length > 0) {
      result.push({ ...item, status: "review", reason: matches.some((match) => match.archived_at) ? "El proveedor coincide con un registro eliminado; revisa el caso." : "Hay varias coincidencias posibles; revisa el caso." });
      continue;
    }
    const sameName = country
      ? [...(byNameCountry.get(nameCountry) ?? []), ...(byName.get(name) ?? []).filter((vendor) => !normalized(vendor.country))]
      : (byName.get(name) ?? []);
    if (sameName.length) {
      result.push({ ...item, status: "review", reason: "El nombre coincide con otro proveedor; revisa país e identificación fiscal." });
      continue;
    }
    const slug = similarKey(data.name);
    const candidates = similar.get(key(country || "*", slug.slice(0, 3))) ?? [];
    if (slug.length >= 5 && candidates.some((candidate) => {
      const other = similarKey(candidate.name);
      return other === slug || (Math.min(other.length, slug.length) >= 5 && (other.startsWith(slug) || slug.startsWith(other)));
    })) {
      result.push({ ...item, status: "review", reason: "Nombre parecido a un proveedor existente; revisa la coincidencia." });
      continue;
    }
    result.push({ ...item, status: "new" });
  }
  return result;
}

export type VendorImportPlanRow = {
  sourceRow: number;
  mode: "create" | "update" | "skip" | "reject";
  data?: NonNullable<MappedVendorRow["data"]>;
  vendorId?: string;
  fields?: VendorImportField[];
};

export function buildVendorImportPlan(rows: VendorPreviewRow[], actorId: string, selectedRows: number[], fields: VendorImportField[],
  existing: ExistingVendorIdentity[] = []): VendorImportPlanRow[] {
  const chosen = new Set(selectedRows);
  const owners = new Map(existing.map((item) => [item.id, item]));
  return rows.map((row) => {
    if (row.status === "error") return { sourceRow: row.sourceRow, mode: "reject" };
    if (row.status === "new" && row.data) return { sourceRow: row.sourceRow, mode: "create", data: row.data };
    const match = row.matchedVendorId ? owners.get(row.matchedVendorId) : undefined;
    if (row.status === "match" && row.data && match?.created_by === actorId && !match.archived_at &&
        chosen.has(row.sourceRow) && fields.length) {
      return { sourceRow: row.sourceRow, mode: "update", data: row.data, vendorId: match.id, fields };
    }
    return { sourceRow: row.sourceRow, mode: "skip" };
  });
}
