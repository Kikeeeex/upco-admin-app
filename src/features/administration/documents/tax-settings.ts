import { DEFAULT_SETTINGS, normalizeSettings, type TaxSettings } from "./tax-engine";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function catalog(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const item = record(entry);
    return { id: Number(item.id ?? index + 1), code: String(item.code ?? ""), name: String(item.name ?? ""), active: item.active !== false };
  });
}

export function readApprovedTaxSettings(value: unknown): TaxSettings {
  const config = record(value);
  const company = record(config.company);
  const ut = record(config.ut);
  const iva = record(config.iva);
  const islrRows = Array.isArray(config.islr_concepts) ? config.islr_concepts : [];
  const conceptOverrides: TaxSettings["conceptOverrides"] = {};
  for (const row of islrRows) {
    const item = record(row);
    const code = String(item.code ?? "").trim().padStart(3, "0");
    if (!/^\d{3}$/.test(code)) continue;
    const rate = item.ratePercent ?? item.rate_percent ?? item.rate;
    const taxableBase = item.taxableBasePercent ?? item.taxable_base_percentage;
    const subtraction = item.subtractionApplies ?? item.subtraction_applies;
    conceptOverrides[code] = {
      ...(rate !== undefined && rate !== "" ? { ratePercent: Number(rate) } : {}),
      ...(taxableBase !== undefined && taxableBase !== "" ? { taxableBasePercent: Number(taxableBase) } : {}),
      ...(subtraction !== undefined ? { subtractionApplies: Boolean(subtraction) } : {}),
    };
  }
  const additionalRates = iva.additional_rate_references;
  if (Array.isArray(additionalRates) && additionalRates.length > 0) {
    throw new Error("Esta versión aprobada no define el cálculo de una alícuota IVA adicional.");
  }
  return normalizeSettings({
    companyName: company.name,
    companyRif: company.rif,
    companyAddress: company.address,
    unitTaxHistory: [{ effectiveAt: ut.effective_from, value: ut.amount }],
    ivaGeneralRate: Number(iva.general_rate),
    ivaReducedRate: Number(iva.reduced_rate),
    conceptOverrides,
    cecos: catalog(config.cecos),
    paymentAccounts: catalog(config.payment_accounts),
  }, DEFAULT_SETTINGS);
}
