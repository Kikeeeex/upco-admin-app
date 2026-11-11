import type { DatabaseSync } from "node:sqlite";
import { getTableColumns } from "drizzle-orm";
import type { documents } from "@/db/schema";
import { documents as documentTable } from "@/db/schema";
import { fail, type calculateDocument, type TaxSettings } from "./core";

type IssuedRow = typeof documents.$inferSelect;
type Recalculated = ReturnType<typeof calculateDocument>;

/** Corrections retain certificate identities; only the document's details and amounts may change. */
export function validateIssuedCorrection(
  original: IssuedRow,
  recalculated: Recalculated,
  reason: string,
  expectedUpdatedAt: string,
  hasLinkedDocument: boolean,
) {
  if (original.status !== "issued" || original.type !== "factura") fail("Solo se pueden corregir facturas emitidas");
  if (original.accountingSnapshot && JSON.parse(original.accountingSnapshot)?.historicalImport === true) {
    fail("No se pueden corregir aquí las facturas históricas importadas; revise el documento original");
  }
  if (reason.length < 10 || reason.length > 500) fail("Explique la corrección en 10 a 500 caracteres");
  if (!expectedUpdatedAt || expectedUpdatedAt !== original.updatedAt) fail("La factura cambió mientras la editabas. Vuelve a abrirla antes de guardar");
  if (hasLinkedDocument) fail("Esta factura tiene una nota relacionada. Revise la nota antes de corregirla");
  if (recalculated.type !== "factura" || recalculated.status !== "issued" || recalculated.affectedDocumentId !== null) {
    fail("La corrección debe conservar el tipo y estado de factura emitida");
  }
  if (Boolean(recalculated.ivaRetentionCents) !== Boolean(original.ivaCertificateNumber)) {
    fail("La corrección agregaría o eliminaría una retención de IVA. Anule y vuelva a emitir el documento");
  }
  if (Boolean(recalculated.islrRetentionCents) !== Boolean(original.islrCertificateNumber)) {
    fail("La corrección agregaría o eliminaría una retención de ISLR. Anule y vuelva a emitir el documento");
  }
  if (original.ivaCertificateNumber && !original.ivaCertificateNumber.startsWith(recalculated.period.replace("-", ""))) {
    fail("El mes de IVA no puede cambiar mientras conserve el comprobante emitido");
  }
  if (original.islrCertificateNumber && !original.islrCertificateNumber.startsWith(recalculated.eventAt.slice(0, 7).replace("-", ""))) {
    fail("El mes de ISLR no puede cambiar mientras conserve el comprobante emitido");
  }
}

export function correctionAccountingSnapshot(recalculated: Recalculated, settings: TaxSettings) {
  const allocations = JSON.parse(recalculated.cecoAllocations) as { cecoId: number; percentage: number }[];
  const cecos = allocations.map(({ cecoId, percentage }) => {
    const ceco = settings.cecos.find(item => item.id === cecoId);
    if (!ceco) fail(`CECO ${cecoId} ya no existe`);
    return { id: ceco.id, code: ceco.code, name: ceco.name, percentage };
  });
  const paymentAccount = settings.paymentAccounts.find(item => item.id === recalculated.paymentAccountId);
  if (!paymentAccount) fail("La cuenta de pago ya no existe");
  return JSON.stringify({ description: recalculated.description, cecos, paymentAccount });
}

/** One synchronous write transaction: compare, update and audit before another request can intervene. */
export function saveIssuedCorrection(
  binding: DatabaseSync,
  original: IssuedRow,
  recalculated: Recalculated,
  vendorId: number,
  accountingSnapshot: string,
  reason: string,
  expectedUpdatedAt: string,
  userId: number,
) {
  binding.exec("BEGIN IMMEDIATE");
  try {
    const current = binding.prepare("SELECT status, updated_at AS updatedAt FROM documents WHERE id = ?")
      .get(original.id) as { status: string; updatedAt: string } | undefined;
    if (current?.status !== "issued" || current.updatedAt !== original.updatedAt) {
      fail("La factura cambió mientras la editabas. Vuelve a abrirla antes de guardar");
    }
    const linked = binding.prepare("SELECT 1 FROM documents WHERE affected_document_id = ? LIMIT 1").get(original.id);
    validateIssuedCorrection(original, recalculated, reason, expectedUpdatedAt, Boolean(linked));

    const updatedAt = new Date().toISOString();
    const correctedAt = updatedAt === original.updatedAt ? new Date(Date.now() + 1).toISOString() : updatedAt;
    const fields: Record<string, unknown> = { ...recalculated, vendorId, accountingSnapshot, updatedAt: correctedAt };
    delete fields.status;
    const columns = getTableColumns(documentTable) as Record<string, { name: string }>;
    const entries = Object.entries(fields).map(([key, value]) => {
      const column = columns[key];
      if (!column) throw new Error(`Campo calculado desconocido: ${key}`);
      return { name: column.name, value: typeof value === "boolean" ? Number(value) : value };
    });
    const result = binding.prepare(`UPDATE documents SET ${entries.map(entry => `\"${entry.name}\" = ?`).join(", ")} WHERE id = ? AND status = 'issued' AND updated_at = ?`)
      .run(...entries.map(entry => entry.value as string | number | null), original.id, original.updatedAt);
    if (result.changes !== 1) fail("La factura cambió mientras la editabas. Vuelve a abrirla antes de guardar");
    const after = { ...original, ...recalculated, vendorId, accountingSnapshot, updatedAt: correctedAt };
    binding.prepare("INSERT INTO audit_events(entity_type, entity_id, action, snapshot) VALUES('document', ?, 'corrected', ?)")
      .run(original.id, JSON.stringify({ reason, correctedByUserId: userId, before: original, after }));
    binding.exec("COMMIT");
  } catch (error) {
    binding.exec("ROLLBACK");
    throw error;
  }
}
