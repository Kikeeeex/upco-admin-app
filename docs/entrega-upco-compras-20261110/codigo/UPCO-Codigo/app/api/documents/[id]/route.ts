import { rm } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { dataDir, getDb, getSqlite } from "@/db";
import { currentUser } from "@/lib/auth";
import { documents } from "@/db/schema";
import { releaseCertificateNumber, retireCertificateNumber } from "@/lib/tax/certificateSequences";
import { voidIssuedDocument } from "@/lib/tax/voidDocument";
import { calculateDocument, fail, type TaxSettings, type VendorInput } from "@/lib/tax/core";
import { correctionAccountingSnapshot, saveIssuedCorrection } from "@/lib/tax/issuedCorrection";
import { apiError, apiUser, audit, findDocument, findVendor, issueDocument, readSettings, toDocument } from "@/lib/tax/server";

type Context = { params: Promise<{ id: string }> };
async function existing(context: Context) {
  const { id } = await context.params;
  const doc = await findDocument(Number(id));
  if (!doc) fail("Documento no encontrado");
  return doc;
}
export async function GET(_request: Request, context: Context) {
  const denied = await apiUser(); if (denied) return denied;
  try {
    const doc = await existing(context);
    const vendor = await findVendor(doc.vendorId);
    return Response.json(toDocument(doc, vendor?.name));
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  const denied = await apiUser(); if (denied) return denied;
  try {
    const old = await existing(context);
    const payload = await request.json() as Record<string, unknown>;
    const action = payload.status === "void" ? "documents.delete" : payload.status === "issued" && old.status === "draft" && Object.keys(payload).length === 1 ? "documents.issue" : "documents.edit";
    const actionDenied = await apiUser(action); if (actionDenied) return actionDenied;
    if (payload.status === "issued" && Object.keys(payload).length === 1) {
      const issued = await issueDocument(old);
      const vendor = await findVendor(issued.vendorId);
      return Response.json(toDocument(issued, vendor?.name));
    }
    if (payload.status === "void") {
      if (Object.keys(payload).length !== 1) fail("La solicitud de anulación no debe modificar otros datos");
      if (old.status !== "issued") fail("Solo se puede anular un documento emitido");
      voidIssuedDocument(getSqlite(), old.id);
      const voided = await findDocument(old.id);
      if (!voided) fail("No se pudo recuperar el documento anulado");
      const vendor = await findVendor(voided.vendorId);
      return Response.json(toDocument(voided, vendor?.name));
    }
    if (old.status === "issued") {
      if (payload.status !== "issued") fail("Para corregir una factura emitida use la opción Editar factura");
      const reason = String(payload.correctionReason ?? "").trim();
      const expectedUpdatedAt = String(payload.expectedUpdatedAt ?? "");
      const vendorId = Number(payload.vendorId ?? old.vendorId);
      const vendor = await findVendor(vendorId);
      if (!vendor || !vendor.active) fail("Seleccione un proveedor activo antes de corregir la factura");
      const currentSettings = await readSettings();
      let issuedSettings: TaxSettings = currentSettings;
      if (old.settingsSnapshot) {
        try { issuedSettings = { ...currentSettings, ...JSON.parse(old.settingsSnapshot) as TaxSettings }; }
        catch { fail("No se puede leer la configuración fiscal de la emisión original"); }
      }
      const priorCecos = new Set((JSON.parse(old.cecoAllocations || "[]") as { cecoId: number }[]).map(item => item.cecoId));
      const correctionSettings: TaxSettings = {
        ...issuedSettings,
        cecos: currentSettings.cecos.map(item => ({ ...item, active: item.active || priorCecos.has(item.id) })),
        paymentAccounts: currentSettings.paymentAccounts.map(item => ({ ...item, active: item.active || item.id === old.paymentAccountId })),
      };
      const oldData = toDocument(old);
      const merged = {
        ...oldData,
        exempt: Math.abs(oldData.exempt), base16: Math.abs(oldData.base16), base8: Math.abs(oldData.base8),
        islrBase: Math.abs(oldData.islrBase), igtfBase: Math.abs(oldData.igtfBase),
        ...payload, status: "issued",
      };
      const values = calculateDocument(merged, vendor as VendorInput, correctionSettings);
      const accountingSnapshot = correctionAccountingSnapshot(values, correctionSettings);
      const user = await currentUser();
      if (!user) fail("La sesión ya no está activa");
      saveIssuedCorrection(getSqlite(), old, values, vendorId, accountingSnapshot, reason, expectedUpdatedAt, user.id);
      const corrected = await findDocument(old.id);
      if (!corrected) fail("No se pudo recuperar la factura corregida");
      return Response.json(toDocument(corrected, vendor.name));
    }
    if (old.status !== "draft") fail("Un documento emitido no se modifica; registre una nota de ajuste");
    const vendorId = Number(payload.vendorId ?? old.vendorId);
    const vendor = await findVendor(vendorId);
    if (!vendor || !vendor.active) fail("Seleccione un proveedor activo");
    const oldData = toDocument(old);
    const merged = { ...oldData, exempt: Math.abs(oldData.exempt), base16: Math.abs(oldData.base16), base8: Math.abs(oldData.base8), islrBase: Math.abs(oldData.islrBase), igtfBase: Math.abs(oldData.igtfBase), ...payload, status: "draft" };
    if (merged.type === "nota_credito" || merged.type === "nota_debito") {
      const affected = await findDocument(Number(merged.affectedDocumentId));
      if (!affected || affected.vendorId !== vendorId || affected.type !== "factura" || affected.status !== "issued") fail("La nota debe afectar una factura emitida del mismo proveedor");
    }
    const values = calculateDocument(merged, vendor as VendorInput, await readSettings());
    const db = getDb();
    const [row] = await db.update(documents).set({ ...values, vendorId, updatedAt: new Date().toISOString() }).where(eq(documents.id, old.id)).returning();
    await audit("document", old.id, "updated", { before: old, after: row });
    return Response.json(toDocument(row, vendor.name));
  } catch (error) { return apiError(error); }
}
export async function DELETE(_request: Request, context: Context) {
  const denied = await apiUser("documents.delete"); if (denied) return denied;
  try {
    const old = await existing(context);
    const user = await currentUser();
    if (!user) fail("La sesión ya no está activa");
    const binding = getSqlite();
    let released: { iva: string | null; islr: string | null } = { iva: null, islr: null };
    binding.exec("BEGIN IMMEDIATE");
    try {
      const current = binding.prepare("SELECT status, iva_certificate_number AS ivaCertificateNumber, islr_certificate_number AS islrCertificateNumber, accounting_snapshot AS accountingSnapshot FROM documents WHERE id = ?")
        .get(old.id) as { status: string; ivaCertificateNumber: string; islrCertificateNumber: string; accountingSnapshot: string } | undefined;
      if (!current) fail("El documento ya no existe");
      const linked = binding.prepare("SELECT number FROM documents WHERE affected_document_id = ? LIMIT 1").get(old.id) as { number: string } | undefined;
      if (linked) fail(`Elimine primero la nota ${linked.number} asociada a esta factura`);
      binding.prepare("DELETE FROM documents WHERE id = ?").run(old.id);
      const historicalImport = Boolean(current.accountingSnapshot && JSON.parse(current.accountingSnapshot)?.historicalImport === true);
      for (const [kind, certificate] of [["iva", current.ivaCertificateNumber], ["islr", current.islrCertificateNumber]] as const) {
        if (!certificate) continue;
        const reserved = historicalImport
          ? retireCertificateNumber(binding, kind, certificate)
          : releaseCertificateNumber(binding, kind, certificate);
        if (!reserved) fail(`No se pudo ${historicalImport ? "reservar" : "liberar"} el comprobante ${kind.toUpperCase()} ${certificate}; la eliminación se canceló`);
        if (!historicalImport) released[kind] = certificate;
      }
      // Remove snapshots containing the deleted document's supplier and amounts.
      binding.prepare("DELETE FROM audit_events WHERE entity_type = 'document' AND entity_id = ?").run(old.id);
      binding.prepare("INSERT INTO audit_events (entity_type, entity_id, action, snapshot) VALUES (?, ?, ?, ?)")
        .run("document", old.id, "deleted", JSON.stringify({ documentId: old.id, priorStatus: current.status, deletedByUserId: user.id, released }));
      binding.exec("COMMIT");
    } catch (error) { binding.exec("ROLLBACK"); throw error; }
    const attachmentsRoot = path.resolve(dataDir, "attachments");
    const attachmentFolder = path.resolve(attachmentsRoot, String(old.id));
    if (path.dirname(attachmentFolder) !== attachmentsRoot) fail("Ruta de adjunto inválida");
    try { await rm(attachmentFolder, { recursive: true, force: true }); }
    catch (error) {
      console.error("No se pudieron retirar los adjuntos del documento eliminado", error);
      return Response.json({ deleted: true, released, warning: "El documento se eliminó, pero no se pudo limpiar su adjunto del disco." });
    }
    return Response.json({ deleted: true, released });
  } catch (error) { return apiError(error); }
}
