"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/features/auth/access";
import { parseFiscalSettingsProposal } from "./rules";

export type FiscalSettingsActionState = { kind: "idle" | "success" | "error"; message: string };

export async function createFiscalSettingsProposal(_previous: FiscalSettingsActionState, form: FormData): Promise<FiscalSettingsActionState> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") return { kind: "error", message: "No tienes permiso para proponer cambios fiscales." };
  let input;
  try {
    input = parseFiscalSettingsProposal({
      proposalLabel: form.get("proposalLabel"), companyName: form.get("companyName"),
      companyRif: form.get("companyRif"), companyAddress: form.get("companyAddress"),
      utAmount: form.get("utAmount"), utEffectiveFrom: form.get("utEffectiveFrom"),
      ivaGeneralRate: form.get("ivaGeneralRate"), ivaReducedRate: form.get("ivaReducedRate"),
      ivaAdditionalRates: form.get("ivaAdditionalRates"), igtfReference: form.get("igtfReference"),
      islrCatalogueReference: form.get("islrCatalogueReference"),
      islrConcepts: form.get("islrConcepts"), cecos: form.get("cecos"),
      paymentAccounts: form.get("paymentAccounts"), sequences: form.get("sequences"),
    });
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : "Revisa los datos de la propuesta." };
  }
  const { data: latestRows, error: latestError } = await access.supabase.from("fiscal_settings_proposals")
    .select("version_no").eq("organization_id", access.organizationId).order("version_no", { ascending: false }).limit(1);
  if (latestError) return { kind: "error", message: "No se pudo consultar la versión actual. Aplica las migraciones de Administración V2." };
  const version = (latestRows?.[0]?.version_no ?? 0) + 1;
  const configValues = {
    company: { name: input.companyName, rif: input.companyRif.toUpperCase(), address: input.companyAddress },
    ut: { amount: input.utAmount, effective_from: input.utEffectiveFrom },
    iva: { general_rate: input.ivaGeneralRate, reduced_rate: input.ivaReducedRate, additional_rate_references: input.ivaAdditionalRates },
    igtf_reference: input.igtfReference,
    islr_catalogue_reference: input.islrCatalogueReference,
    islr_concepts: input.islrConcepts, cecos: input.cecos,
    payment_accounts: input.paymentAccounts, sequences: input.sequences,
  };
  const { error } = await access.supabase.from("fiscal_settings_proposals").insert({
    organization_id: access.organizationId, created_by: access.user.id, version_no: version,
    proposal_label: input.proposalLabel, config_values: configValues, status: "proposed",
  });
  if (error) return { kind: "error", message: error.code === "23505" ? "La versión cambió mientras guardabas. Inténtalo otra vez." : "No se pudo guardar la propuesta fiscal." };
  revalidatePath("/administracion/configuracion-fiscal");
  return { kind: "success", message: `Propuesta V${version} guardada. No está activa y no afecta documentos.` };
}

export async function activateFiscalSettingsProposal(form: FormData): Promise<void> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") redirect("/administracion/configuracion-fiscal?activacion=sin-permiso");
  const proposalId = form.get("proposalId");
  if (typeof proposalId !== "string" || !/^[0-9a-f-]{36}$/i.test(proposalId)) redirect("/administracion/configuracion-fiscal?activacion=error");
  const { error } = await access.supabase.rpc("activate_fiscal_settings_proposal", { p_proposal_id: proposalId });
  if (error) redirect("/administracion/configuracion-fiscal?activacion=error");
  revalidatePath("/administracion/configuracion-fiscal");
  revalidatePath("/administracion/compras");
  revalidatePath("/administracion/retenciones");
  redirect("/administracion/configuracion-fiscal?activacion=ok");
}
