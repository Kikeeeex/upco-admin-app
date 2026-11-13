export type FiscalVendorAuditRow = {
  id: string;
  legal_name: string;
  tax_identifier: string;
  tax_address: string;
  taxpayer_type: string | null;
  person_type: string;
  residency: string | null;
  iva_retention_rate: number;
  active: boolean;
  review_state: string;
  source_file: string | null;
  fiscal_machine_numbers: string | null;
};

export type FiscalVendorAuditIssue = { code: string; label: string; severity: "alta" | "media" | "informativa" };
export type FiscalVendorAuditItem = {
  id: string;
  rif: string;
  name: string;
  active: boolean;
  needsReview: boolean;
  sourceFile: string;
  issues: FiscalVendorAuditIssue[];
};
export type FiscalVendorAuditReport = {
  generatedAt: string;
  scope: "internal-data-quality";
  summary: { total: number; pendingReview: number; importedTotal: number; withIssues: number; highPriority: number };
  items: FiscalVendorAuditItem[];
};

const normalizeRif = (value: string) => value.toUpperCase().replace(/[\s-]/g, "");
const normalizeName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

function residencyMatches(person: string, residency: string | null): boolean {
  if (person === "natural") return residency === "residente" || residency === "no_residente";
  if (person === "legal") return residency === "domiciliada" || residency === "no_domiciliada";
  return false;
}

function machineListIsInvalid(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const value: unknown = JSON.parse(raw);
    return !Array.isArray(value) || value.some((item) => typeof item !== "string");
  } catch { return true; }
}

export function auditFiscalVendors(rows: FiscalVendorAuditRow[], now = new Date()): FiscalVendorAuditReport {
  const rifCounts = new Map<string, number>();
  const names = new Map<string, Set<string>>();
  for (const row of rows) {
    const rif = normalizeRif(row.tax_identifier);
    rifCounts.set(rif, (rifCounts.get(rif) ?? 0) + 1);
    const name = normalizeName(row.legal_name);
    if (name) {
      const rifs = names.get(name) ?? new Set<string>();
      rifs.add(rif);
      names.set(name, rifs);
    }
  }

  const items = rows.map((row) => {
    const issues: FiscalVendorAuditIssue[] = [];
    const add = (code: string, label: string, severity: FiscalVendorAuditIssue["severity"]) => issues.push({ code, label, severity });
    const rif = normalizeRif(row.tax_identifier);
    const name = normalizeName(row.legal_name);
    const person = row.person_type.toLowerCase();
    const taxpayer = row.taxpayer_type?.toLowerCase() ?? "";
    if (!/^[VEJPG]\d{9}$/.test(rif)) add("rif_format", "Revisar formato del RIF", "alta");
    if ((rifCounts.get(rif) ?? 0) > 1) add("rif_duplicated", "RIF repetido en otra ficha", "alta");
    if (!row.legal_name.trim()) add("name_missing", "Falta razón social", "alta");
    if (!row.tax_address.trim()) add("address_missing", "Falta dirección fiscal", "alta");
    if (name && (names.get(name)?.size ?? 0) > 1) add("name_multiple_rifs", "Mismo nombre con distintos RIF; cotejar", "media");
    if (person === "legal" && /^[VE]\d/.test(rif) || person === "natural" && /^[JPG]\d/.test(rif)) {
      add("person_rif_mismatch", "Tipo de persona y prefijo de RIF requieren cotejo", "alta");
    }
    if (!taxpayer) add("taxpayer_missing", "Falta tipo de contribuyente", "alta");
    else if (!["especial", "ordinario", "formal"].includes(taxpayer)) add("taxpayer_invalid", "Tipo de contribuyente fuera del catálogo", "alta");
    if (!residencyMatches(person, row.residency)) add("residency_inconsistent", "Residencia o domicilio no corresponde al tipo de persona", "alta");
    if (![0, 75, 100].includes(Number(row.iva_retention_rate))) add("iva_rate_invalid", "Porcentaje IVA fuera de 0, 75 o 100 %", "alta");
    if (machineListIsInvalid(row.fiscal_machine_numbers)) add("fiscal_machine_invalid", "Lista de máquinas fiscales ilegible", "media");
    const needsReview = row.review_state !== "confirmed";
    if (needsReview) add("pending_fiscal_review", "Datos fiscales pendientes de confirmar", "media");
    return { id: row.id, rif: row.tax_identifier, name: row.legal_name, active: row.active, needsReview, sourceFile: row.source_file ?? "", issues };
  }).sort((left, right) => {
    const priority = (item: FiscalVendorAuditItem) => item.issues.some((issue) => issue.severity === "alta") ? 3 :
      item.issues.some((issue) => issue.severity === "media") ? 2 : item.issues.length ? 1 : 0;
    return priority(right) - priority(left) || left.name.localeCompare(right.name, "es");
  });

  return {
    generatedAt: now.toISOString(), scope: "internal-data-quality",
    summary: {
      total: rows.length,
      pendingReview: rows.filter((row) => row.review_state !== "confirmed").length,
      importedTotal: rows.filter((row) => Boolean(row.source_file)).length,
      withIssues: items.filter((item) => item.issues.length > 0).length,
      highPriority: items.filter((item) => item.issues.some((issue) => issue.severity === "alta")).length,
    },
    items,
  };
}

function csvCell(value: string): string {
  const safe = value.replace(/^[\s]*([=+@-])/, "'$&");
  return `"${safe.replace(/"/g, '""')}"`;
}

export function fiscalVendorAuditCsv(report: FiscalVendorAuditReport): string {
  const headers = ["ID", "RIF", "Razón social", "Activo", "Revisión fiscal pendiente", "Prioridad", "Observaciones", "Archivo fuente"];
  const lines = report.items.map((item) => {
    const priority = item.issues.some((issue) => issue.severity === "alta") ? "Alta" :
      item.issues.some((issue) => issue.severity === "media") ? "Media" : item.issues.length ? "Informativa" : "Sin hallazgos";
    return [item.id, item.rif, item.name, item.active ? "Sí" : "No", item.needsReview ? "Sí" : "No", priority,
      item.issues.map((issue) => issue.label).join(" | "), item.sourceFile].map(csvCell).join(";");
  });
  return `\ufeff${headers.map(csvCell).join(";")}\r\n${lines.join("\r\n")}\r\n`;
}
