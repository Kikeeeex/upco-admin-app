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
