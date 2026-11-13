import type { getAccessContext } from "@/features/auth/access";

type AllowedContext = Extract<Awaited<ReturnType<typeof getAccessContext>>, { kind: "allowed" }>;
export type AdministrationDraftStatus = {
  total: number;
  issued: number;
  voided: number;
  invoices: number;
  creditNotes: number;
  debitNotes: number;
  islrMarked: number;
  igtfMarked: number;
  periods: number;
  error: boolean;
};

export type AdministrationPeriodStatus = {
  total: number;
  issued: number;
  drafts: number;
  invoiceTotalCents: number;
  ivaRetainedCents: number;
  islrRetainedCents: number;
  mixedRateDocuments: number;
  error: boolean;
};

function snapshotCents(value: unknown, key: string) {
  const snapshot = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const amount = Number(snapshot[key] ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export async function loadAdministrationPeriodStatus(
  access: AllowedContext,
  period: string,
  half: 1 | 2,
): Promise<AdministrationPeriodStatus> {
  const { data, error } = await access.supabase.from("administration_documents")
    .select("status, document_type, base16_cents, base8_cents, calculation_snapshot")
    .eq("organization_id", access.organizationId).eq("tax_period", period).eq("tax_half", half).limit(10000);
  if (error || !data) return { total: 0, issued: 0, drafts: 0, invoiceTotalCents: 0, ivaRetainedCents: 0, islrRetainedCents: 0, mixedRateDocuments: 0, error: true };
  const issued = data.filter((row) => row.status === "issued");
  return {
    total: data.length,
    issued: issued.length,
    drafts: data.filter((row) => row.status === "draft").length,
    invoiceTotalCents: issued.reduce((sum, row) => sum + snapshotCents(row.calculation_snapshot, "totalCents"), 0),
    ivaRetainedCents: issued.reduce((sum, row) => sum + snapshotCents(row.calculation_snapshot, "ivaRetentionCents"), 0),
    islrRetainedCents: issued.reduce((sum, row) => sum + snapshotCents(row.calculation_snapshot, "islrRetentionCents"), 0),
    mixedRateDocuments: data.filter((row) => Number(row.base16_cents) !== 0 && Number(row.base8_cents) !== 0).length,
    error: false,
  };
}

export async function loadAdministrationDraftStatus(access: AllowedContext): Promise<AdministrationDraftStatus> {
  const { data, error } = await access.supabase.from("administration_documents")
    .select("document_type, islr_applies, igtf_applies, tax_period, status")
    .eq("organization_id", access.organizationId).limit(10000);
  if (error || !data) return { total: 0, issued: 0, voided: 0, invoices: 0, creditNotes: 0, debitNotes: 0, islrMarked: 0, igtfMarked: 0, periods: 0, error: true };
  const drafts = data.filter((row) => row.status === "draft");
  return {
    total: drafts.length,
    issued: data.filter((row) => row.status === "issued").length,
    voided: data.filter((row) => row.status === "voided").length,
    invoices: drafts.filter((row) => row.document_type === "invoice").length,
    creditNotes: drafts.filter((row) => row.document_type === "credit_note").length,
    debitNotes: drafts.filter((row) => row.document_type === "debit_note").length,
    islrMarked: drafts.filter((row) => row.islr_applies).length,
    igtfMarked: drafts.filter((row) => row.igtf_applies).length,
    periods: new Set(data.map((row) => row.tax_period).filter(Boolean)).size,
    error: false,
  };
}
