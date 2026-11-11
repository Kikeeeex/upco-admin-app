const REVIEW_LABELS: Record<string, string> = {
  rif: "RIF",
  name: "Razón social",
  address: "Dirección fiscal",
  taxpayerType: "Tipo de contribuyente",
  personType: "Tipo de persona",
  residency: "Residencia o domicilio",
  ivaRetentionRate: "Retención IVA",
};

function reviewValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(reviewValue).filter(Boolean).join(", ");
  return "";
}

export function vendorReviewText(raw: string): string {
  if (!raw) return "";
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return raw; }
  if (typeof parsed === "string") return parsed;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
  return Object.entries(parsed)
    .map(([field, value]) => {
      const detail = reviewValue(value);
      return detail ? `${REVIEW_LABELS[field] || field}: ${detail}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

export function fiscalMachineNumbers(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean)
      : [];
  } catch { return []; }
}
