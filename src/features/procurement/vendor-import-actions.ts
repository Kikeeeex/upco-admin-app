"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { analyzeVendorRows, buildVendorImportPlan, type ExistingVendorIdentity } from "./vendor-import-rules";
import { guessVendorMapping, mapVendorRows, readVendorFile, vendorImportFields, type ParsedVendorFile, type VendorImportField, type VendorImportMapping } from "./vendor-import-parser";

type ErrorResult = { kind: "error"; message: string };
type CountByStatus = { new: number; match: number; review: number; duplicate_file: number; error: number };
type PreviewRow = { sourceRow: number; name: string; country: string; salesArea: string; status: keyof CountByStatus;
  reason: string; errors: string[]; warnings: string[]; editable: boolean };
const fail = (message: string): ErrorResult => ({ kind: "error", message });

function stringField(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value ? value : undefined;
}

function mappingFor(form: FormData, file: ParsedVendorFile): VendorImportMapping {
  const raw = stringField(form, "mapping");
  if (!raw) return guessVendorMapping(file.headers);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("El mapeo de columnas no es válido."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El mapeo de columnas no es válido.");
  const result: VendorImportMapping = {};
  for (const field of vendorImportFields) {
    const index = (value as Record<string, unknown>)[field.key];
    if (index !== undefined) {
      if (!Number.isInteger(index) || typeof index !== "number") throw new Error("El mapeo de columnas no es válido.");
      result[field.key] = index;
    }
  }
  return result;
}

async function readForm(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Selecciona un archivo XLSX o CSV.");
  const parsed = await readVendorFile(file, stringField(form, "sheet"));
  const mapping = mappingFor(form, parsed);
  const rows = mapVendorRows(parsed, mapping);
  return { file, parsed, mapping, rows };
}

async function existingVendors(access: Extract<Awaited<ReturnType<typeof getAccessContext>>, { kind: "allowed" }>): Promise<ExistingVendorIdentity[]> {
  const all: ExistingVendorIdentity[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await access.supabase.from("vendors")
      .select("id,name,country,tax_identifier,archived_at,created_by")
      .eq("organization_id", access.organizationId).order("id").range(offset, offset + 499);
    if (error) throw new Error("No se pudo consultar el catálogo actual.");
    all.push(...(data ?? []));
    if ((data ?? []).length < 500) return all;
  }
}

async function digestFor(file: File, mapping: VendorImportMapping, sheet: string | null, fingerprint: unknown): Promise<string> {
  return createHash("sha256").update(Buffer.from(await file.arrayBuffer()))
    .update(JSON.stringify({ mapping, sheet, fingerprint })).digest("hex");
}

function summary(rows: ReturnType<typeof analyzeVendorRows>): CountByStatus {
  const counts: CountByStatus = { new: 0, match: 0, review: 0, duplicate_file: 0, error: 0 };
  for (const row of rows) counts[row.status]++;
  return counts;
}

export async function inspectVendorImport(form: FormData): Promise<ErrorResult | { kind: "success"; fileName: string; format: string;
  sheets: string[]; sheetName: string | null; headers: string[]; mapping: VendorImportMapping; rowsRead: number; blankRows: number }> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return fail("Tu sesión no está autorizada.");
  try {
    const { parsed, mapping } = await readForm(form);
    return { kind: "success", fileName: parsed.fileName, format: parsed.format, sheets: parsed.sheets,
      sheetName: parsed.sheetName, headers: parsed.headers, mapping, rowsRead: parsed.rows.length, blankRows: parsed.blankRows };
  } catch (error) { return fail(error instanceof Error ? error.message : "No se pudo leer el archivo."); }
}

export async function previewVendorImport(form: FormData): Promise<ErrorResult | { kind: "success"; digest: string;
  rows: PreviewRow[]; counts: CountByStatus; rowsRead: number; blankRows: number }> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return fail("Tu sesión no está autorizada.");
  try {
    const { file, parsed, mapping, rows } = await readForm(form);
    const existing = await existingVendors(access);
    const analyzed = analyzeVendorRows(rows, existing);
    const digest = await digestFor(file, mapping, parsed.sheetName, analyzed.map((row) => [row.sourceRow, row.status, row.matchedVendorId]));
    const owners = new Map(existing.map((vendor) => [vendor.id, vendor]));
    return { kind: "success", digest, rowsRead: analyzed.length, blankRows: parsed.blankRows,
      counts: summary(analyzed), rows: analyzed.map((row) => ({ sourceRow: row.sourceRow, name: row.data?.name ?? "—",
        country: row.data?.country ?? "", salesArea: row.data?.salesArea ?? "", status: row.status,
        reason: row.reason ?? "", errors: row.errors, warnings: row.warnings,
        editable: row.status === "match" && owners.get(row.matchedVendorId ?? "")?.created_by === access.user.id })) };
  } catch (error) { return fail(error instanceof Error ? error.message : "No se pudo preparar la vista previa."); }
}

export async function commitVendorImport(form: FormData): Promise<ErrorResult | { kind: "success"; batchId: string;
  counts: { created: number; updated: number; skipped: number; rejected: number }; incidents: Array<{ sourceRow: number; status: string; reason: string }> }> {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return fail("Tu sesión no está autorizada.");
  try {
    const { file, parsed, mapping, rows } = await readForm(form);
    const existing = await existingVendors(access);
    const analyzed = analyzeVendorRows(rows, existing);
    const digest = await digestFor(file, mapping, parsed.sheetName, analyzed.map((row) => [row.sourceRow, row.status, row.matchedVendorId]));
    if (stringField(form, "digest") !== digest) return fail("El archivo o el catálogo cambió. Vuelve a generar la vista previa.");
    let selectedRows: unknown = [];
    let selectedFields: unknown = [];
    try {
      selectedRows = JSON.parse(stringField(form, "selectedRows") ?? "[]");
      selectedFields = JSON.parse(stringField(form, "selectedFields") ?? "[]");
    } catch { return fail("La selección de actualizaciones no es válida."); }
    if (!Array.isArray(selectedRows) || selectedRows.length > rows.length ||
      selectedRows.some((n) => !Number.isInteger(n) || n < 2) || !Array.isArray(selectedFields) ||
      selectedFields.some((field) => !vendorImportFields.some((candidate) => candidate.key === field))) {
      return fail("La selección de actualizaciones no es válida.");
    }
    const plan = buildVendorImportPlan(analyzed, access.user.id, selectedRows as number[], selectedFields as VendorImportField[], existing);
    const { data, error } = await access.supabase.rpc("import_vendor_directory", {
      p_organization_id: access.organizationId, p_format: parsed.format, p_rows: plan,
    });
    if (error || !data || typeof data !== "object") return fail("No se pudo guardar el lote. No se importó ninguna fila de este intento.");
    revalidatePath("/procura");
    return { kind: "success", batchId: String(data.batchId), counts: { created: Number(data.created), updated: Number(data.updated),
      skipped: Number(data.skipped), rejected: Number(data.rejected) },
    incidents: analyzed.flatMap((row, index) => {
      if (plan[index].mode === "create" || plan[index].mode === "update") return [];
      return [{ sourceRow: row.sourceRow, status: row.status, reason: row.errors.join(" ") || row.reason || "Fila omitida." }];
    }) };
  } catch (error) { return fail(error instanceof Error ? error.message : "No se pudo completar la importación."); }
}
