"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/features/auth/access";
import { parseAdministrationDraft, type AdministrationDraftInput } from "./rules";
import { calculateDocument, normalizeVendor, money } from "./tax-engine";
import { readApprovedTaxSettings } from "./tax-settings";
import { createAdministrationServiceClient } from "./service-client";

export type CalculationPreview = {
  exempt: string; base16: string; iva16: string; base8: string; iva8: string;
  subtotal: string; total: string; ivaRetained: string; igtf: string; islrRetained: string; netPayable: string;
};
export type AdministrationDraftActionState = { kind: "idle" | "success" | "error" | "preview"; message: string; preview?: CalculationPreview };
const initialError = (message: string): AdministrationDraftActionState => ({ kind: "error", message });

function fields(form: FormData): AdministrationDraftInput {
  return parseAdministrationDraft({
    fiscalVendorId: form.get("fiscalVendorId"), documentType: form.get("documentType"),
    invoiceNumber: form.get("invoiceNumber"), controlNumber: form.get("controlNumber"),
    issuedAt: form.get("issuedAt"), eventAt: form.get("eventAt"), taxPeriod: form.get("taxPeriod"),
    taxHalf: form.get("taxHalf"), periodOverrideReason: form.get("periodOverrideReason"),
    affectedDocumentId: form.get("affectedDocumentId"), description: form.get("description"),
    exempt: form.get("exempt"), base16: form.get("base16"), base8: form.get("base8"),
    ivaRetentionRate: form.get("ivaRetentionRate"), ivaRetentionReason: form.get("ivaRetentionReason"),
    igtfApplies: form.get("igtfApplies") === "on", igtfBase: form.get("igtfBase"),
    islrApplies: form.get("islrApplies") === "on", islrConceptCode: form.get("islrConceptCode"),
    islrBase: form.get("islrBase"), islrManual: form.get("islrManual"), islrRate: form.get("islrRate"),
    islrSubtraction: form.get("islrSubtraction"),
    islrManualReason: form.get("islrManualReason"), paymentAccountLabel: form.get("paymentAccountLabel"),
    cecoAllocationNote: form.get("cecoAllocationNote"),
  });
}

async function calculatePreview(input: AdministrationDraftInput, access: Extract<Awaited<ReturnType<typeof getAccessContext>>, { kind: "allowed" }>): Promise<AdministrationDraftActionState> {
  if (!input.fiscalVendorId) return initialError("Selecciona un proveedor fiscal para calcular la retención.");
  if (!input.invoiceNumber || !input.issuedAt || !input.eventAt) return initialError("Indica número, fecha de emisión y fecha de pago o abono.");
  if (input.documentType === "invoice" && input.affectedDocumentId) return initialError("Una factura no puede tener factura afectada.");
  if (input.documentType !== "invoice" && !input.affectedDocumentId) return initialError("Selecciona la factura afectada por la nota.");
  const [{ data: vendorRow, error: vendorError }, { data: active, error: settingsError }] = await Promise.all([
    access.supabase.from("fiscal_vendors")
      .select("id, legal_name, tax_identifier, tax_address, taxpayer_type, person_type, residency, iva_retention_rate, active, review_state")
      .eq("id", input.fiscalVendorId).eq("organization_id", access.organizationId).maybeSingle(),
    access.supabase.from("fiscal_settings_activations")
      .select("config_snapshot").eq("organization_id", access.organizationId).is("ended_at", null).maybeSingle(),
  ]);
  if (vendorError || !vendorRow) return initialError("El proveedor fiscal seleccionado no está disponible.");
  if (!vendorRow.active || vendorRow.review_state !== "confirmed") return initialError("Solo puede calcularse con un proveedor activo y revisado.");
  if (settingsError || !active) return initialError("Activa primero una versión de configuración fiscal.");
  if (input.affectedDocumentId) {
    const { data: affected, error: affectedError } = await access.supabase.from("administration_documents")
      .select("id, document_type, fiscal_vendor_id").eq("id", input.affectedDocumentId)
      .eq("organization_id", access.organizationId).maybeSingle();
    if (affectedError || !affected || affected.document_type !== "invoice" || affected.fiscal_vendor_id !== input.fiscalVendorId) {
      return initialError("La factura afectada debe pertenecer al mismo proveedor.");
    }
  }
  try {
    const settings = readApprovedTaxSettings(active.config_snapshot);
    const taxpayer = String(vendorRow.taxpayer_type ?? "ordinario").toLowerCase();
    const normalizedVendor = normalizeVendor({
      rif: vendorRow.tax_identifier,
      name: vendorRow.legal_name,
      address: vendorRow.tax_address,
      taxpayerType: taxpayer.includes("formal") ? "formal" : taxpayer.includes("especial") ? "especial" : "ordinario",
      personType: vendorRow.person_type === "legal" ? "juridica" : "natural",
      residency: vendorRow.residency ?? undefined,
      ivaRetentionRate: vendorRow.iva_retention_rate,
      active: vendorRow.active,
    });
    const islrBaseCents = input.islrBase || input.exempt + input.base16 + input.base8;
    const result = calculateDocument({
      type: input.documentType === "invoice" ? "factura" : input.documentType === "credit_note" ? "nota_credito" : "nota_debito",
      issuedAt: input.issuedAt, eventAt: input.eventAt,
      period: input.taxPeriod, half: input.taxHalf,
      periodOverrideReason: input.periodOverrideReason,
      number: input.invoiceNumber, controlNumber: input.controlNumber,
      affectedDocumentId: input.affectedDocumentId,
      description: input.description,
      exempt: money(input.exempt), base16: money(input.base16), base8: money(input.base8),
      ivaRetentionRate: input.ivaRetentionRate, ivaRetentionReason: input.ivaRetentionReason,
      igtfApplies: input.igtfApplies, igtfBase: money(input.igtfBase),
      islrApplies: input.islrApplies, islrConceptCode: input.islrConceptCode,
      islrBase: money(islrBaseCents), islrManual: input.islrManual === undefined ? undefined : money(input.islrManual).toFixed(2),
      islrAmount: input.islrManual === undefined ? undefined : money(input.islrManual).toFixed(2),
      islrRate: input.islrRate, islrSubtraction: money(input.islrSubtraction),
    }, normalizedVendor, settings, true);
    return {
      kind: "preview", message: "Cálculo de vista previa; aún no se guardó ni emitió.",
      preview: {
        exempt: money(result.exemptCents).toFixed(2), base16: money(result.base16Cents).toFixed(2), iva16: money(result.iva16Cents).toFixed(2),
        base8: money(result.base8Cents).toFixed(2), iva8: money(result.iva8Cents).toFixed(2), subtotal: money(result.subtotalCents).toFixed(2),
        total: money(result.totalCents).toFixed(2), ivaRetained: money(result.ivaRetentionCents).toFixed(2),
        igtf: money(result.igtfAmountCents).toFixed(2), islrRetained: money(result.islrRetentionCents).toFixed(2), netPayable: money(result.netPayableCents).toFixed(2),
      },
    };
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "No se pudo calcular la vista previa.");
  }
}

export async function createAdministrationDraft(_previous: AdministrationDraftActionState, form: FormData): Promise<AdministrationDraftActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") return initialError("No tienes permiso para registrar borradores de compra.");
  let input: AdministrationDraftInput;
  try { input = fields(form); }
  catch { return initialError("Revisa los datos del borrador. No se calculó ningún impuesto."); }
  if (form.get("intent") === "calculate") return calculatePreview(input, access);
  if (input.fiscalVendorId) {
    const { data: vendor, error } = await access.supabase.from("fiscal_vendors").select("id")
      .eq("id", input.fiscalVendorId).eq("organization_id", access.organizationId).maybeSingle();
    if (error || !vendor) return initialError("El proveedor fiscal seleccionado no está disponible.");
  }
  if (input.affectedDocumentId) {
    if (input.documentType === "invoice") return initialError("Solo una nota de crédito o débito puede referir una factura afectada.");
    if (!input.fiscalVendorId) return initialError("Selecciona el proveedor de la nota antes de relacionar la factura.");
    const { data: affected, error } = await access.supabase.from("administration_documents").select("id, document_type, fiscal_vendor_id")
      .eq("id", input.affectedDocumentId).eq("organization_id", access.organizationId).maybeSingle();
    if (error || !affected || affected.document_type !== "invoice" || affected.fiscal_vendor_id !== input.fiscalVendorId) return initialError("La factura afectada debe pertenecer al mismo proveedor de la nota.");
  }
  const { error } = await access.supabase.from("administration_documents").insert({
    organization_id: access.organizationId, created_by: access.user.id,
    fiscal_vendor_id: input.fiscalVendorId ?? null, document_type: input.documentType,
    invoice_number: input.invoiceNumber ?? null, control_number: input.controlNumber ?? null,
    issued_at: input.issuedAt ?? null, event_at: input.eventAt ?? null,
    tax_period: input.taxPeriod ?? null, tax_half: input.taxHalf ?? null,
    period_override_reason: input.periodOverrideReason ?? null,
    affected_document_id: input.affectedDocumentId ?? null, description: input.description,
    exempt_cents: input.exempt, base16_cents: input.base16, base8_cents: input.base8,
    iva_retention_rate: input.ivaRetentionRate ?? 75, iva_retention_reason: input.ivaRetentionReason ?? null,
    igtf_applies: input.igtfApplies, igtf_base_cents: input.igtfBase,
    islr_applies: input.islrApplies, islr_concept_code: input.islrConceptCode ?? null,
    islr_base_cents: input.islrBase, islr_manual_cents: input.islrManual ?? null,
    islr_manual_reason: input.islrManualReason ?? null,
    islr_manual_rate: input.islrRate ?? null, islr_manual_subtraction_cents: input.islrSubtraction,
    payment_account_label: input.paymentAccountLabel ?? null, ceco_allocation_note: input.cecoAllocationNote ?? null,
    status: "draft",
  });
  if (error?.code === "23505") return initialError("Ya existe un documento con ese número para el proveedor y tipo seleccionados.");
  if (error) return initialError("No se pudo guardar el borrador.");
  revalidatePath("/administracion/compras");
  revalidatePath("/administracion");
  return { kind: "success", message: "Borrador guardado. Los impuestos no se calcularon y la operación no fue emitida." };
}

export async function updateAdministrationDraft(_previous: AdministrationDraftActionState, form: FormData): Promise<AdministrationDraftActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") return initialError("No tienes permiso para editar borradores de compra.");
  const id = form.get("id");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return initialError("El borrador no es válido.");
  let input: AdministrationDraftInput;
  try { input = fields(form); }
  catch { return initialError("Revisa los datos del borrador. No se calculó ningún impuesto."); }
  if (form.get("intent") === "calculate") return calculatePreview(input, access);
  if (form.get("intent") === "issue") {
    const result = await issueAdministrationDraft(id, input, access);
    if (result.kind === "success") redirect("/administracion/compras?emision=ok");
    return result;
  }
  if (input.fiscalVendorId) {
    const { data: vendor, error } = await access.supabase.from("fiscal_vendors").select("id")
      .eq("id", input.fiscalVendorId).eq("organization_id", access.organizationId).maybeSingle();
    if (error || !vendor) return initialError("El proveedor fiscal seleccionado no está disponible.");
  }
  if (input.affectedDocumentId) {
    if (input.documentType === "invoice") return initialError("Solo una nota de crédito o débito puede referir una factura afectada.");
    if (!input.fiscalVendorId) return initialError("Selecciona el proveedor de la nota antes de relacionar la factura.");
    const { data: affected, error } = await access.supabase.from("administration_documents").select("id, document_type, fiscal_vendor_id")
      .eq("id", input.affectedDocumentId).eq("organization_id", access.organizationId).maybeSingle();
    if (error || !affected || affected.document_type !== "invoice" || affected.fiscal_vendor_id !== input.fiscalVendorId) return initialError("La factura afectada debe pertenecer al mismo proveedor de la nota.");
  }
  const { data, error: lookupError } = await access.supabase.from("administration_documents").select("id")
    .eq("id", id).eq("organization_id", access.organizationId).eq("status", "draft").maybeSingle();
  if (lookupError || !data) return initialError("El borrador no está disponible para editar.");
  const { data: updated, error } = await access.supabase.from("administration_documents").update({
    fiscal_vendor_id: input.fiscalVendorId ?? null, document_type: input.documentType,
    invoice_number: input.invoiceNumber ?? null, control_number: input.controlNumber ?? null,
    issued_at: input.issuedAt ?? null, event_at: input.eventAt ?? null,
    tax_period: input.taxPeriod ?? null, tax_half: input.taxHalf ?? null,
    period_override_reason: input.periodOverrideReason ?? null,
    affected_document_id: input.affectedDocumentId ?? null, description: input.description,
    exempt_cents: input.exempt, base16_cents: input.base16, base8_cents: input.base8,
    iva_retention_rate: input.ivaRetentionRate ?? 75, iva_retention_reason: input.ivaRetentionReason ?? null,
    igtf_applies: input.igtfApplies, igtf_base_cents: input.igtfBase,
    islr_applies: input.islrApplies, islr_concept_code: input.islrConceptCode ?? null,
    islr_base_cents: input.islrBase, islr_manual_cents: input.islrManual ?? null,
    islr_manual_reason: input.islrManualReason ?? null,
    islr_manual_rate: input.islrRate ?? null, islr_manual_subtraction_cents: input.islrSubtraction,
    payment_account_label: input.paymentAccountLabel ?? null, ceco_allocation_note: input.cecoAllocationNote ?? null,
  }).eq("id", id).eq("organization_id", access.organizationId).eq("status", "draft").select("id").maybeSingle();
  if (error?.code === "23505") return initialError("Ya existe un documento con ese número para el proveedor y tipo seleccionados.");
  if (error || !updated) return initialError("No se pudo actualizar el borrador. Confirma que siga en estado borrador.");
  revalidatePath("/administracion/compras");
  revalidatePath(`/administracion/compras/${id}`);
  revalidatePath("/administracion");
  return { kind: "success", message: "Borrador actualizado. Los impuestos no se calcularon y la operación no fue emitida." };
}

function configRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function initialSequence(config: Record<string, unknown>, kind: "iva" | "islr", period: string): number | null {
  const rows = Array.isArray(config.sequences) ? config.sequences : [];
  const matching = rows.filter((raw) => {
    const row = configRecord(raw);
    const rowKind = String(row.kind ?? row.tax ?? row.type ?? "").toLowerCase();
    return rowKind === kind && (!row.period || String(row.period) === period);
  });
  for (const raw of matching) {
    const row = configRecord(raw);
    const value = Number(row.nextNumber ?? row.next_number ?? row.next);
    if (Number.isSafeInteger(value) && value > 0 && value <= 99_999_999) return value;
  }
  return null;
}

async function issueAdministrationDraft(
  id: string,
  input: AdministrationDraftInput,
  access: Extract<Awaited<ReturnType<typeof getAccessContext>>, { kind: "allowed" }>,
): Promise<AdministrationDraftActionState> {
  if (!input.fiscalVendorId || !input.invoiceNumber || !input.issuedAt || !input.eventAt) return initialError("Completa proveedor, número y fechas antes de emitir.");
  const [draftResult, settingsResult] = await Promise.all([
    access.supabase.from("administration_documents").select("*").eq("id", id).eq("organization_id", access.organizationId).eq("status", "draft").maybeSingle(),
    access.supabase.from("fiscal_settings_activations").select("id, config_snapshot, version_no").eq("organization_id", access.organizationId).is("ended_at", null).maybeSingle(),
  ]);
  const draft = draftResult.data;
  if (draftResult.error || !draft) return initialError("El borrador ya no está disponible para emisión.");
  if (settingsResult.error || !settingsResult.data) return initialError("Activa una configuración fiscal antes de emitir.");
  const config = configRecord(settingsResult.data.config_snapshot);
  const [{ data: vendorRow, error: vendorError }, { data: affected, error: affectedError }] = await Promise.all([
    access.supabase.from("fiscal_vendors").select("id, legal_name, tax_identifier, tax_address, taxpayer_type, person_type, residency, iva_retention_rate, active, review_state")
      .eq("id", input.fiscalVendorId).eq("organization_id", access.organizationId).maybeSingle(),
    input.affectedDocumentId ? access.supabase.from("administration_documents").select("id, document_type, fiscal_vendor_id, status")
      .eq("id", input.affectedDocumentId).eq("organization_id", access.organizationId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (vendorError || !vendorRow || !vendorRow.active || vendorRow.review_state !== "confirmed") return initialError("La emisión requiere un proveedor fiscal activo y revisado.");
  if (input.documentType !== "invoice" && (affectedError || !affected || affected.document_type !== "invoice" || affected.status !== "issued" || affected.fiscal_vendor_id !== input.fiscalVendorId)) {
    return initialError("La nota requiere una factura emitida del mismo proveedor.");
  }
  if (input.documentType !== "invoice" && input.islrApplies) return initialError("La emisión de notas con retención ISLR está bloqueada por la regla aprobada de la entrega.");
  try {
    const settings = readApprovedTaxSettings(config);
    const taxpayer = String(vendorRow.taxpayer_type ?? "ordinario").toLowerCase();
    const normalizedVendor = normalizeVendor({
      rif: vendorRow.tax_identifier, name: vendorRow.legal_name, address: vendorRow.tax_address,
      taxpayerType: taxpayer.includes("formal") ? "formal" : taxpayer.includes("especial") ? "especial" : "ordinario",
      personType: vendorRow.person_type === "legal" ? "juridica" : "natural", residency: vendorRow.residency ?? undefined,
      ivaRetentionRate: vendorRow.iva_retention_rate, active: vendorRow.active,
    });
    const account = settings.paymentAccounts.find((row) => row.active && [row.code, row.name, String(row.id)].some((value) => value.toLowerCase() === (input.paymentAccountLabel ?? "").trim().toLowerCase()));
    if (!account) return initialError("Selecciona una cuenta de pago activa según la configuración fiscal.");
    const allocations = (input.cecoAllocationNote ?? "").split(";").filter(Boolean).map((entry) => {
      const [code, percentage] = entry.split(":");
      const ceco = settings.cecos.find((row) => row.active && row.code.toUpperCase() === code.toUpperCase());
      if (!ceco) throw new Error(`El CECO ${code} no existe o está inactivo en la configuración fiscal.`);
      return { cecoId: ceco.id, percentage: Number(percentage.replace(",", ".")) };
    });
    if (!allocations.length) return initialError("Indica la distribución CECO activa; los porcentajes deben sumar 100 %.");
    const islrBaseCents = input.islrBase || input.exempt + input.base16 + input.base8;
    const calculation = calculateDocument({
      type: input.documentType === "invoice" ? "factura" : input.documentType === "credit_note" ? "nota_credito" : "nota_debito",
      issuedAt: input.issuedAt, eventAt: input.eventAt, period: input.taxPeriod, half: input.taxHalf,
      periodOverrideReason: input.periodOverrideReason, number: input.invoiceNumber, controlNumber: input.controlNumber,
      affectedDocumentId: input.affectedDocumentId, description: input.description,
      exempt: money(input.exempt), base16: money(input.base16), base8: money(input.base8),
      ivaRetentionRate: input.ivaRetentionRate, ivaRetentionReason: input.ivaRetentionReason,
      igtfApplies: input.igtfApplies, igtfBase: money(input.igtfBase), islrApplies: input.islrApplies,
      islrConceptCode: input.islrConceptCode, islrBase: money(islrBaseCents),
      islrManual: input.islrManual === undefined ? undefined : money(input.islrManual).toFixed(2),
      islrAmount: input.islrManual === undefined ? undefined : money(input.islrManual).toFixed(2),
      islrRate: input.islrRate, islrSubtraction: money(input.islrSubtraction),
      paymentAccountId: account.id, cecoAllocations: allocations, status: "issued",
    }, normalizedVendor, settings);
    if (input.documentType === "invoice" && input.affectedDocumentId) return initialError("Una factura no puede tener factura afectada.");
    const service = createAdministrationServiceClient();
    if (!service) return initialError("La emisión está configurada solo en el servidor; falta SUPABASE_SERVICE_ROLE_KEY.");
    const ivaInitialNext = initialSequence(config, "iva", calculation.period);
    const islrInitialNext = initialSequence(config, "islr", String(calculation.eventAt).slice(0, 7));
    const accountingSnapshot = {
      paymentAccount: { id: account.id, code: account.code, name: account.name },
      cecoAllocations: allocations.map((allocation) => ({ ...allocation, code: settings.cecos.find((row) => row.id === allocation.cecoId)?.code })),
      cecoSummary: calculation.ceco,
    };
    const { error } = await service.rpc("issue_administration_document", {
      p_document_id: id, p_actor_id: access.user.id,
      p_draft_fields: {
        fiscal_vendor_id: input.fiscalVendorId, document_type: input.documentType,
        invoice_number: input.invoiceNumber, control_number: input.controlNumber ?? "",
        issued_at: input.issuedAt, event_at: input.eventAt, tax_period: calculation.period, tax_half: String(calculation.half),
        period_override_reason: input.periodOverrideReason ?? "", affected_document_id: input.affectedDocumentId ?? "",
        description: input.description, exempt_cents: input.exempt, base16_cents: input.base16, base8_cents: input.base8,
        iva_retention_rate: input.ivaRetentionRate ?? 75, iva_retention_reason: input.ivaRetentionReason ?? "",
        igtf_applies: input.igtfApplies, igtf_base_cents: input.igtfBase, islr_applies: input.islrApplies,
        islr_concept_code: input.islrConceptCode ?? "", islr_base_cents: islrBaseCents,
        islr_manual_cents: input.islrManual ?? "", islr_manual_reason: input.islrManualReason ?? "",
        islr_manual_rate: input.islrRate ?? "", islr_manual_subtraction_cents: input.islrSubtraction,
        payment_account_label: input.paymentAccountLabel ?? "", ceco_allocation_note: input.cecoAllocationNote ?? "",
      },
      p_calculation_snapshot: calculation,
      p_settings_snapshot: { activationId: settingsResult.data.id, version: settingsResult.data.version_no, config },
      p_accounting_snapshot: accountingSnapshot, p_iva_initial_next: ivaInitialNext, p_islr_initial_next: islrInitialNext,
    });
    if (error) return initialError(error.message.includes("sequence") ? "No se pudo emitir: inicializa los correlativos IVA e ISLR en la configuración fiscal." : "No se pudo emitir el documento; el borrador permanece sin cambios.");
    revalidatePath("/administracion/compras");
    revalidatePath(`/administracion/compras/${id}`);
    revalidatePath("/administracion/retenciones");
    revalidatePath("/administracion/libros");
    return { kind: "success", message: "Documento emitido con cálculo, configuración y distribución contable inmutables." };
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "No se pudo validar la emisión.");
  }
}

export async function voidAdministrationDocument(
  _previous: AdministrationDraftActionState,
  form: FormData,
): Promise<AdministrationDraftActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") return initialError("Solo una persona administradora puede anular un documento.");
  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || reason.length < 10 || reason.length > 1000) {
    return initialError("Indica el motivo de anulación (10 a 1000 caracteres).");
  }
  const { data: document, error: lookupError } = await access.supabase.from("administration_documents")
    .select("id,status").eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (lookupError || !document || document.status !== "issued") return initialError("Solo se puede anular un documento emitido disponible.");
  const service = createAdministrationServiceClient();
  if (!service) return initialError("La anulación requiere SUPABASE_SERVICE_ROLE_KEY configurada solo en el servidor.");
  const { error } = await service.rpc("void_administration_document", {
    p_document_id: id, p_actor_id: access.user.id, p_reason: reason,
  });
  if (error) return initialError("No se pudo anular el documento. Verifica que siga emitido y que el motivo esté documentado.");
  for (const path of ["/administracion/compras", `/administracion/compras/${id}`, "/administracion/retenciones", "/administracion/libros", "/administracion/reportes"]) revalidatePath(path);
  return { kind: "success", message: "Documento anulado con auditoría. Sus correlativos quedan reservados y no se reutilizan." };
}
