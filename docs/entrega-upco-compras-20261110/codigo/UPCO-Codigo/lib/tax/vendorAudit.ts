export type VendorAuditSource = {
  id: number;
  rif: string;
  name: string;
  address: string;
  taxpayerType: string;
  personType: string;
  residency: string;
  ivaRetentionRate: number;
  needsReview: boolean;
  importReview: string;
  importConfidence: string;
  sourceDate: string;
  sourcePdf: string;
  usesFiscalMachine: boolean;
  fiscalMachineNumbers: string;
  active: boolean;
};

export type VendorAuditIssue = {
  code: string;
  label: string;
  severity: "alta" | "media" | "informativa";
};

export type VendorAuditItem = {
  id: number;
  rif: string;
  name: string;
  active: boolean;
  needsReview: boolean;
  sourceDate: string;
  sourcePdf: string;
  issues: VendorAuditIssue[];
};

export type VendorAuditReport = {
  generatedAt: string;
  scope: "internal-data-quality";
  summary: {
    total: number;
    pendingFiscalReview: number;
    importedTotal: number;
    importedPendingReview: number;
    withIssues: number;
    highPriority: number;
    issueCounts: Record<string, number>;
  };
  items: VendorAuditItem[];
};

function normalizedRif(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

function normalizedName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function reviewFields(raw: string): Set<string> {
  try {
    const value: unknown = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? new Set(Object.keys(value)) : new Set();
  } catch { return new Set(); }
}

function machineCount(raw: string): number | null {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value.filter(item => typeof item === "string" && item.trim()).length : null;
  } catch { return null; }
}

export function auditVendors(rows: VendorAuditSource[], now = new Date()): VendorAuditReport {
  const rifCounts = new Map<string, number>();
  const names = new Map<string, Set<string>>();
  for (const row of rows) {
    const rif = normalizedRif(row.rif);
    rifCounts.set(rif, (rifCounts.get(rif) || 0) + 1);
    const name = normalizedName(row.name);
    if (name) {
      const rifs = names.get(name) || new Set<string>();
      rifs.add(rif);
      names.set(name, rifs);
    }
  }

  const items = rows.map(row => {
    const issues: VendorAuditIssue[] = [];
    const add = (code: string, label: string, severity: VendorAuditIssue["severity"]) => issues.push({ code, label, severity });
    const rif = normalizedRif(row.rif);
    const name = normalizedName(row.name);
    const review = reviewFields(row.importReview);
    if (!/^[VEJPG]\d{9}$/.test(rif)) add("rif_format", "Revisar formato del RIF", "alta");
    if (rifCounts.get(rif)! > 1) add("rif_duplicated", "RIF repetido en otra ficha", "alta");
    if (!row.name.trim()) add("name_missing", "Falta razón social", "alta");
    if (!row.address.trim()) add("address_missing", "Falta dirección fiscal", "alta");
    if (name && (names.get(name)?.size || 0) > 1) add("name_multiple_rifs", "Mismo nombre con distintos RIF; cotejar", "media");
    if ((rif.startsWith("V") || rif.startsWith("E")) && row.personType === "juridica" ||
        (rif.startsWith("J") || rif.startsWith("P") || rif.startsWith("G")) && row.personType === "natural") {
      add("person_rif_mismatch", "Tipo de persona y prefijo de RIF requieren cotejo", "alta");
    }
    if (!["especial", "ordinario", "formal"].includes(row.taxpayerType)) {
      add("taxpayer_invalid", "Tipo de contribuyente fuera del catálogo", "alta");
    }
    if (!["natural", "juridica"].includes(row.personType)) add("person_invalid", "Tipo de persona fuera del catálogo", "alta");
    if (!["residente", "no_residente", "domiciliada", "no_domiciliada"].includes(row.residency) ||
        row.personType === "natural" && !["residente", "no_residente"].includes(row.residency) ||
        row.personType === "juridica" && !["domiciliada", "no_domiciliada"].includes(row.residency)) {
      add("residency_inconsistent", "Residencia o domicilio no corresponde al tipo de persona", "alta");
    }
    if (![0, 75, 100].includes(row.ivaRetentionRate)) add("iva_rate_invalid", "Porcentaje IVA fuera de 0, 75 o 100 %", "alta");
    if (row.usesFiscalMachine && machineCount(row.fiscalMachineNumbers) === 0) {
      add("fiscal_machine_missing", "Máquina fiscal activada sin número registrado", "media");
    }
    if (row.usesFiscalMachine && machineCount(row.fiscalMachineNumbers) === null) {
      add("fiscal_machine_invalid", "Lista de máquinas fiscales ilegible", "media");
    }
    if (row.importConfidence && !row.sourcePdf.trim()) add("source_missing", "Importado sin PDF de origen", "media");
    if (row.needsReview) add("pending_fiscal_review", "Datos fiscales pendientes de confirmar", "media");
    // Keep the import provenance visible after a user confirms the profile.
    // Confirmation changes workflow status, not the original PDF evidence.
    const provenanceSeverity = row.needsReview ? "media" : "informativa";
    if (review.has("taxpayerType")) add("taxpayer_unverified", "Tipo de contribuyente sin respaldo en comprobantes importados", provenanceSeverity);
    if (review.has("personType")) add("person_inferred", "Tipo de persona inferido durante la importación", provenanceSeverity);
    if (review.has("residency")) add("residency_inferred", "Residencia o domicilio inferido durante la importación", provenanceSeverity);
    if (review.has("ivaRetentionRate")) add("iva_rate_unverified", "Porcentaje IVA inicial sin respaldo en comprobantes importados", provenanceSeverity);
    if (review.has("rif")) add("rif_supplemental_source", "RIF obtenido de respaldo complementario", provenanceSeverity);
    return {
      id: row.id, rif: row.rif, name: row.name, active: row.active,
      needsReview: row.needsReview, sourceDate: row.sourceDate, sourcePdf: row.sourcePdf,
      issues,
    };
  }).sort((a, b) => {
    const priority = (item: VendorAuditItem) => item.issues.some(issue => issue.severity === "alta") ? 3 :
      item.issues.some(issue => issue.severity === "media") ? 2 : item.issues.length ? 1 : 0;
    return priority(b) - priority(a) || a.name.localeCompare(b.name, "es");
  });
  const issueCounts: Record<string, number> = {};
  for (const item of items) for (const issue of item.issues) issueCounts[issue.code] = (issueCounts[issue.code] || 0) + 1;
  return {
    generatedAt: now.toISOString(), scope: "internal-data-quality",
    summary: {
      total: rows.length,
      pendingFiscalReview: rows.filter(row => row.needsReview).length,
      importedTotal: rows.filter(row => Boolean(row.importConfidence.trim())).length,
      importedPendingReview: rows.filter(row => row.needsReview && Boolean(row.importConfidence.trim())).length,
      withIssues: items.filter(item => item.issues.length).length,
      highPriority: items.filter(item => item.issues.some(issue => issue.severity === "alta")).length,
      issueCounts,
    },
    items,
  };
}

function csvCell(value: string | number): string {
  const safe = String(value).replace(/^[\s]*([=+@-])/, "'$&");
  return `"${safe.replace(/"/g, '""')}"`;
}

export function vendorAuditCsv(report: VendorAuditReport): string {
  const headers = ["ID", "RIF", "Razón social", "Activo", "Revisión fiscal pendiente", "Prioridad", "Observaciones", "Fecha soporte", "PDF soporte"];
  const lines = report.items.map(item => {
    const priority = item.issues.some(issue => issue.severity === "alta") ? "Alta" :
      item.issues.some(issue => issue.severity === "media") ? "Media" : item.issues.length ? "Informativa" : "Sin hallazgos";
    return [item.id, item.rif, item.name, item.active ? "Sí" : "No", item.needsReview ? "Sí" : "No", priority,
      item.issues.map(issue => issue.label).join(" | "), item.sourceDate, item.sourcePdf].map(csvCell).join(";");
  });
  return `\ufeff${headers.map(csvCell).join(";")}\r\n${lines.join("\r\n")}\r\n`;
}
