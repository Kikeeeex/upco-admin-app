import { ISLR_CONCEPTS } from "./islr-concepts";

export type VendorInput = {
  rif: string; name: string; address?: string;
  taxpayerType?: "especial" | "ordinario" | "formal";
  personType?: "natural" | "juridica";
  residency?: "residente" | "domiciliada" | "no_residente" | "no_domiciliada";
  ivaRetentionRate?: 0 | 75 | 100;
  usesFiscalMachine?: boolean;
  fiscalMachineNumbers?: string;
  email?: string; phone?: string; active?: boolean; needsReview?: boolean;
};

export type TaxSettings = {
  companyName: string;
  companyRif: string;
  companyAddress: string;
  unitTaxHistory: { effectiveAt: string; value: number }[];
  ivaGeneralRate: number;
  ivaReducedRate: number;
  ivaLegalReference: string;
  islrLegalReference: string;
  conceptOverrides: Record<string, { ratePercent?: number; taxableBasePercent?: number; subtractionApplies?: boolean }>;
  cecos: CatalogItem[];
  paymentAccounts: CatalogItem[];
};

export type CatalogItem = { id: number; code: string; name: string; active: boolean };

export const DEFAULT_SETTINGS: TaxSettings = {
  companyName: "",
  companyRif: "",
  companyAddress: "",
  unitTaxHistory: [{ effectiveAt: "2025-06-02", value: 43 }],
  ivaGeneralRate: 16,
  ivaReducedRate: 8,
  ivaLegalReference: "Providencia Administrativa SNAT/2025/000054, G.O. N° 43.171 del 16/07/2025",
  islrLegalReference: "Decreto N° 1.808, G.O. N° 36.203 del 12/05/1997",
  conceptOverrides: {},
  cecos: [],
  paymentAccounts: [],
};

export const IGTF_RATE_PERCENT = 3;

export class InputError extends Error { status = 400; }
export function fail(message: string): never { throw new InputError(message); }

export function moneyCents(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 9e12) fail(`${label}: monto inválido`);
  return Math.round((n + Number.EPSILON) * 100);
}
export function money(cents: number): number { return Math.round(cents) / 100; }

export function validateDate(value: unknown, label: string): string {
  const str = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) fail(`${label}: use AAAA-MM-DD`);
  const date = new Date(`${str}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== str) fail(`${label}: fecha inválida`);
  return str;
}
export function todayCaracas(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function fiscalHalf(date: string): { period: string; half: 1 | 2 } {
  return { period: date.slice(0, 7), half: Number(date.slice(8)) <= 15 ? 1 : 2 };
}
function nextHalf(period: string, half: 1 | 2): { period: string; half: 1 | 2 } {
  if (half === 1) return { period, half: 2 };
  const [year, month] = period.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return { period: next.toISOString().slice(0, 7), half: 1 };
}

export function normalizeVendor(raw: Record<string, unknown>): VendorInput {
  const rif = String(raw.rif ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (!/^[VEJPG]\d{9}$/.test(rif)) fail("RIF: debe tener una letra y nueve dígitos");
  const name = String(raw.name ?? "").trim();
  if (!name) fail("La razón social es obligatoria");
  const taxpayerType = String(raw.taxpayerType ?? "ordinario") as VendorInput["taxpayerType"];
  if (!["especial", "ordinario", "formal"].includes(taxpayerType ?? "")) fail("Tipo de contribuyente inválido");
  const personType = String(raw.personType ?? "juridica") as VendorInput["personType"];
  if (!["natural", "juridica"].includes(personType ?? "")) fail("Tipo de persona inválido");
  const residency = String(raw.residency ?? (personType === "natural" ? "residente" : "domiciliada")) as VendorInput["residency"];
  if (!["residente", "domiciliada", "no_residente", "no_domiciliada"].includes(residency ?? "")) fail("Residencia o domicilio inválido");
  const ivaRetentionRate = Number(raw.ivaRetentionRate ?? (taxpayerType === "formal" ? 0 : 75)) as 0 | 75 | 100;
  if (![0, 75, 100].includes(ivaRetentionRate)) fail("Retención de IVA: seleccione 0, 75 o 100 %");
  let machineNumbers: unknown = raw.fiscalMachineNumbers ?? [];
  if (typeof machineNumbers === "string") {
    try { machineNumbers = JSON.parse(machineNumbers); }
    catch { fail("Los números de máquina fiscal no tienen un formato válido"); }
  }
  if (!Array.isArray(machineNumbers) || machineNumbers.length > 200) fail("Registre hasta 200 números de máquina fiscal");
  const fiscalMachineNumbers = machineNumbers.map((entry) => {
    if (typeof entry !== "string") fail("El número de máquina fiscal debe ser texto");
    const number = entry.trim().toUpperCase();
    if (!number || number.length > 80 || /[\x00-\x1F\x7F]/.test(number)) fail("Cada número de máquina fiscal debe tener entre 1 y 80 caracteres en una sola línea");
    return number;
  });
  if (new Set(fiscalMachineNumbers).size !== fiscalMachineNumbers.length) fail("No repita números de máquina fiscal en un proveedor");
  return {
    rif, name, taxpayerType, personType, residency, ivaRetentionRate,
    usesFiscalMachine: raw.usesFiscalMachine === true || raw.usesFiscalMachine === 1,
    fiscalMachineNumbers: JSON.stringify(fiscalMachineNumbers),
    address: String(raw.address ?? "").trim(),
    email: String(raw.email ?? "").trim(), phone: String(raw.phone ?? "").trim(),
    active: raw.active === undefined ? true : Boolean(raw.active),
    needsReview: false,
  };
}

export function normalizeSettings(raw: Record<string, unknown>, prior: TaxSettings): TaxSettings {
  const merged = { ...prior, ...raw } as TaxSettings;
  const companyRif = String(merged.companyRif ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (!/^[VEJPG]\d{9}$/.test(companyRif)) fail("RIF de UPCO inválido");
  if (!String(merged.companyName ?? "").trim()) fail("Nombre de empresa obligatorio");
  if (![merged.ivaReducedRate, merged.ivaGeneralRate].every(x => Number.isFinite(Number(x)) && Number(x) >= 0 && Number(x) <= 100)) fail("Alícuotas de IVA inválidas");
  if (!Array.isArray(merged.unitTaxHistory) || !merged.unitTaxHistory.length) fail("Debe registrar la UT vigente");
  merged.unitTaxHistory = merged.unitTaxHistory.map(entry => {
    const value = money(moneyCents(entry.value, "UT"));
    if (value <= 0) fail("La unidad tributaria debe ser mayor que cero");
    return { effectiveAt: validateDate(entry.effectiveAt, "Vigencia UT"), value };
  }).sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt));
  merged.companyRif = companyRif;
  merged.companyName = String(merged.companyName).trim();
  merged.companyAddress = String(merged.companyAddress ?? "").trim();
  const rawOverrides = merged.conceptOverrides && typeof merged.conceptOverrides === "object" ? merged.conceptOverrides : {};
  const cleanOverrides: TaxSettings["conceptOverrides"] = {};
  for (const [code, override] of Object.entries(rawOverrides)) {
    if (!ISLR_CONCEPTS.some(x => x.code === code) || !override || typeof override !== "object") fail(`Regla ISLR inválida: ${code}`);
    const result: { ratePercent?: number; taxableBasePercent?: number; subtractionApplies?: boolean } = {};
    for (const key of ["ratePercent", "taxableBasePercent"] as const) {
      if (override[key] !== undefined) {
        const n = Number(override[key]);
        if (!Number.isFinite(n) || n < 0 || n > 100) fail(`${code}: ${key} inválido`);
        result[key] = n;
      }
    }
    if (override.subtractionApplies !== undefined) result.subtractionApplies = Boolean(override.subtractionApplies);
    cleanOverrides[code] = result;
  }
  merged.conceptOverrides = cleanOverrides;
  function catalog(value: unknown, existing: CatalogItem[], label: string): CatalogItem[] {
    if (!Array.isArray(value)) fail(`${label}: se esperaba una lista`);
    const known = new Set(existing.map(x => x.id));
    let nextId = Math.max(0, ...existing.map(x => x.id)) + 1;
    const codes = new Set<string>();
    const ids = new Set<number>();
    return value.map((candidate: unknown) => {
      if (!candidate || typeof candidate !== "object") fail(`${label}: elemento inválido`);
      const item = candidate as Record<string, unknown>;
      const id = Number.isInteger(Number(item.id)) && Number(item.id) > 0 ? Number(item.id) : nextId++;
      if (item.id !== undefined && id !== Number(item.id) && Number(item.id) > 0) fail(`${label}: ID inválido`);
      if (item.id !== undefined && Number(item.id) > 0 && !known.has(id)) fail(`${label}: ID desconocido ${id}`);
      const code = String(item.code ?? "").trim().toUpperCase();
      const name = String(item.name ?? "").trim();
      if (!code || code.length > 40 || /[\t\r\n]/.test(code)) fail(`${label}: código inválido`);
      if (name.length < 2 || name.length > 160) fail(`${label}: nombre entre 2 y 160 caracteres`);
      if (ids.has(id) || codes.has(code)) fail(`${label}: código o ID duplicado`);
      ids.add(id); codes.add(code);
      return { id, code, name, active: item.active === undefined ? true : Boolean(item.active) };
    });
  }
  merged.cecos = catalog(merged.cecos, prior.cecos, "CECO");
  merged.paymentAccounts = catalog(merged.paymentAccounts, prior.paymentAccounts, "Cuenta de pago");
  return merged;
}

export function calculateDocument(raw: Record<string, unknown>, vendor: VendorInput, settings: TaxSettings, previewOnly = false) {
  const type = String(raw.type ?? "factura");
  if (!["factura", "nota_credito", "nota_debito"].includes(type)) fail("Tipo de documento inválido");
  const issuedAt = validateDate(raw.issuedAt, "Fecha de emisión");
  const eventAt = validateDate(raw.eventAt ?? todayCaracas(), "Fecha de pago o abono");
  const currentHalf = fiscalHalf(eventAt);
  const period = String(raw.period ?? currentHalf.period);
  const half = Number(raw.half ?? currentHalf.half) as 1 | 2;
  if (!/^\d{4}-\d{2}$/.test(period) || ![1, 2].includes(half)) fail("Período o quincena inválidos");
  const chosen = `${period}-${half}`;
  const expected = `${currentHalf.period}-${currentHalf.half}`;
  const next = nextHalf(currentHalf.period, currentHalf.half);
  if (chosen !== expected && chosen !== `${next.period}-${next.half}`) fail("Solo se admite la quincena actual o la siguiente");
  const periodOverrideReason = String(raw.periodOverrideReason ?? "").trim();
  if (chosen !== expected && !periodOverrideReason) fail("Indique el motivo de diferir la quincena");
  const number = String(raw.number ?? "").trim();
  if (!number) fail("Número de documento obligatorio");
  const controlNumber = String(raw.controlNumber ?? "").trim();
  if (/[\t\r\n]/.test(number + controlNumber)) fail("Los números de documento y control no pueden contener saltos de línea o tabulaciones");
  if (type !== "factura" && !raw.affectedDocumentId) fail("La nota requiere factura afectada");
  const exemptCents = moneyCents(raw.exempt, "Exento");
  const base16Cents = moneyCents(raw.base16, "Base 16 %");
  const base8Cents = moneyCents(raw.base8, "Base 8 %");
  const iva16Cents = Math.round(base16Cents * Number(settings.ivaGeneralRate) / 100);
  const iva8Cents = Math.round(base8Cents * Number(settings.ivaReducedRate) / 100);
  const subtotalCents = exemptCents + base16Cents + base8Cents;
  if (subtotalCents <= 0) fail("El subtotal debe ser mayor que cero");
  const totalCents = subtotalCents + iva16Cents + iva8Cents;
  const fullyExempt = base16Cents === 0 && base8Cents === 0;
  const selectedIvaRetentionRate = Number(raw.ivaRetentionRate ?? vendor.ivaRetentionRate ?? 75);
  if (![0, 75, 100].includes(selectedIvaRetentionRate)) fail("Retención de IVA: seleccione 0, 75 o 100 %");
  // An exempt operation causes no IVA and therefore no IVA withholding, even
  // when this vendor normally has a 75% or 100% retention rate.
  const ivaRetentionRate = fullyExempt ? 0 : selectedIvaRetentionRate;
  let ivaRetentionReason = fullyExempt ? "Operación exenta de IVA" : String(raw.ivaRetentionReason ?? "").trim();
  if (ivaRetentionRate === 0 && !ivaRetentionReason) {
    if (vendor.taxpayerType === "formal") ivaRetentionReason = "Proveedor formal";
    else fail("Indique el motivo de no practicar retención de IVA");
  }
  if (ivaRetentionRate === 100 && !ivaRetentionReason) fail("Indique la causal de retención del 100 %");
  const ivaRetentionCents = Math.round((iva16Cents + iva8Cents) * ivaRetentionRate / 100);
  const igtfApplies = Boolean(raw.igtfApplies);
  const igtfBaseCents = igtfApplies ? moneyCents(raw.igtfBase, "Base IGTF") : 0;
  if (igtfApplies && igtfBaseCents <= 0) fail("Indique una base imponible IGTF mayor que cero");
  const igtfAmountCents = Math.round(igtfBaseCents * IGTF_RATE_PERCENT / 100);
  const islrApplies = Boolean(raw.islrApplies);
  const islrConceptCode = islrApplies ? String(raw.islrConceptCode ?? "").padStart(3, "0") : "";
  const islrManual = islrApplies && Boolean(raw.islrManual);
  const islrManualReason = islrManual ? String(raw.islrManualReason ?? "").trim() : "";
  let islrBaseCents = 0, islrTaxableBaseCents = 0, islrRate = 0, islrSubtractionCents = 0, islrRetentionCents = 0;
  if (islrApplies) {
    const concept = ISLR_CONCEPTS.find(x => x.code === islrConceptCode);
    if (!concept) fail("Concepto de ISLR no encontrado");
    const override = settings.conceptOverrides[islrConceptCode] ?? {};
    const ratePercent = override.ratePercent ?? concept.ratePercent;
    const taxableBasePercent = override.taxableBasePercent ?? concept.taxableBasePercent;
    if (!islrManual && (concept.calculation !== "flat" || ratePercent == null || taxableBasePercent == null)) fail("Este concepto requiere validar su cálculo. Use cálculo manual con motivo documentado o configure la norma.");
    if (concept.beneficiary) {
      const beneficiary = vendor.personType === "natural" ? (vendor.residency === "residente" ? "PNR" : "PNNR") : (vendor.residency === "domiciliada" ? "PJD" : "PJND");
      if (beneficiary !== concept.beneficiary) fail(`El concepto ${islrConceptCode} corresponde a ${concept.beneficiary}; el proveedor es ${beneficiary}`);
    }
    islrBaseCents = moneyCents(raw.islrBase ?? money(subtotalCents), "Base ISLR");
    if (islrBaseCents > subtotalCents) fail("La base ISLR no puede superar el subtotal sin IVA");
    if (islrManual) {
      if (!islrManualReason) fail("Explique el cálculo manual de ISLR");
      islrRate = Number(raw.islrRate ?? ratePercent);
      if (!Number.isFinite(islrRate) || islrRate < 0 || islrRate > 100) fail("Porcentaje manual de ISLR inválido");
      islrSubtractionCents = moneyCents(raw.islrSubtraction ?? 0, "Sustraendo ISLR");
      islrTaxableBaseCents = islrBaseCents;
      islrRetentionCents = raw.islrAmount === undefined
        ? Math.max(0, Math.round(islrBaseCents * islrRate / 100) - islrSubtractionCents)
        : moneyCents(raw.islrAmount, "Monto ISLR");
    } else {
      islrRate = ratePercent!;
      const taxableCents = Math.round(islrBaseCents * taxableBasePercent! / 100);
      islrTaxableBaseCents = taxableCents;
      const grossCents = Math.round(taxableCents * islrRate / 100);
      const subtract = override.subtractionApplies ?? concept.subtractionApplies;
      if (subtract) {
        const ut = [...settings.unitTaxHistory].reverse().find(x => x.effectiveAt <= eventAt);
        if (!ut) fail("Falta valor de UT vigente para la fecha de operación");
        islrSubtractionCents = Math.round(ut.value * 100 * islrRate / 100 * 83.3334);
      }
      islrRetentionCents = Math.max(0, grossCents - islrSubtractionCents);
    }
  }
  const sign = type === "nota_credito" ? -1 : 1;
  const description = String(raw.description ?? "").trim();
  if (description.length < 10 || description.length > 2000) fail("La descripción debe tener entre 10 y 2.000 caracteres");
  const paymentAccountId = Number(raw.paymentAccountId);
  const account = settings.paymentAccounts.find(x => x.id === paymentAccountId && x.active);
  if (!account && !previewOnly) fail("Seleccione una cuenta de pago activa");
  const rawAllocations = raw.cecoAllocations;
  if ((!Array.isArray(rawAllocations) || !rawAllocations.length) && !previewOnly) fail("Asigne al menos un CECO");
  const allocated = new Set<number>();
  let basisPoints = 0;
  const cecoAllocations = (Array.isArray(rawAllocations) ? rawAllocations : []).map((entry: unknown) => {
    if (!entry || typeof entry !== "object") fail("Distribución CECO inválida");
    const item = entry as Record<string, unknown>;
    const cecoId = Number(item.cecoId);
    const percentage = Number(item.percentage ?? item.percent);
    const ceco = settings.cecos.find(x => x.id === cecoId && x.active);
    if (!ceco || allocated.has(cecoId)) fail("Seleccione CECO activos sin repetir");
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100 || Math.abs(percentage * 100 - Math.round(percentage * 100)) > 0.000001) fail("Cada porcentaje CECO debe ser mayor que cero y tener máximo dos decimales");
    allocated.add(cecoId);
    basisPoints += Math.round(percentage * 100);
    return { cecoId, percentage };
  });
  if (basisPoints !== 10_000 && !(previewOnly && cecoAllocations.length === 0)) fail("La distribución CECO debe sumar exactamente 100 %");
  const cecoSummary = cecoAllocations.map(x => `${settings.cecos.find(c => c.id === x.cecoId)!.code} ${x.percentage}%`).join("; ");
  return {
    type, issuedAt, eventAt, period, half, periodOverrideReason, number, controlNumber,
    affectedDocumentId: raw.affectedDocumentId ? Number(raw.affectedDocumentId) : null,
    exemptCents: exemptCents * sign, base16Cents: base16Cents * sign, base8Cents: base8Cents * sign,
    iva16Cents: iva16Cents * sign, iva8Cents: iva8Cents * sign,
    subtotalCents: subtotalCents * sign, totalCents: totalCents * sign,
    ivaRetentionRate, ivaRetentionReason, ivaRetentionCents: ivaRetentionCents * sign,
    igtfApplies, igtfBaseCents: igtfBaseCents * sign, igtfAmountCents: igtfAmountCents * sign,
    islrApplies, islrConceptCode, islrManual, islrManualReason, islrBaseCents: islrBaseCents * sign,
    islrTaxableBaseCents: islrTaxableBaseCents * sign, islrRate,
    islrSubtractionCents: islrSubtractionCents * sign, islrRetentionCents: islrRetentionCents * sign,
    netPayableCents: (totalCents + igtfAmountCents - ivaRetentionCents - islrRetentionCents) * sign,
    ceco: cecoSummary, cecoAllocations: JSON.stringify(cecoAllocations), paymentAccountId: account?.id ?? null, accountingSnapshot: "", description,
    status: String(raw.status ?? "draft"),
  };
}
