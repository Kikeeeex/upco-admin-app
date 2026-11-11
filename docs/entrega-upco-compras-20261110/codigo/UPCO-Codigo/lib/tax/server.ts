import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db";
import { currentUser } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import { appSettings, auditEvents, documents, vendors } from "@/db/schema";
import { DEFAULT_SETTINGS, InputError, money, type TaxSettings } from "./core";
import { reserveCertificateNumber } from "./certificateSequences";
import { fiscalMachineNumbers, vendorReviewText } from "./vendorPresentation";

export async function apiUser(permission?: Permission | "master"): Promise<Response | null> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Inicia sesión para acceder a los datos de UPCO." }, { status: 401 });
  if (permission && (permission === "master" ? user.role !== "master" : !hasPermission(user, permission))) {
    return Response.json({ error: "Tu usuario no tiene permiso para esta acción." }, { status: 403 });
  }
  return null;
}

export function apiError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Error inesperado";
  const causeMessage = error && typeof error === "object" && "cause" in error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message} ${causeMessage}`;
  const status = error instanceof InputError ? error.status :
    /UNIQUE constraint failed/i.test(combined) ? 409 :
    /no such table/i.test(combined) ? 503 : 500;
  if (status === 500) console.error(error);
  const detail = status === 503 ? "La base de datos no está preparada. Ejecute la migración local." : status === 409 ? "Ya existe un registro con esos datos." : status === 500 ? "Error interno del servidor." : message;
  return Response.json({ error: detail }, { status });
}

export async function readSettings(): Promise<TaxSettings> {
  const db = getDb();
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "tax"));
  if (!row) return DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(row.value) as Partial<TaxSettings>;
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    throw new Error("Configuración fiscal dañada");
  }
}

export function toVendor(row: typeof vendors.$inferSelect) {
  return {
    ...row,
    importReview: vendorReviewText(row.importReview),
    fiscalMachineNumbers: fiscalMachineNumbers(row.fiscalMachineNumbers),
    code: `P${String(row.id).padStart(6, "0")}`,
  };
}

export function toDocument(row: typeof documents.$inferSelect, vendorName?: string) {
  const accountingSnapshot = row.accountingSnapshot ? JSON.parse(row.accountingSnapshot) : null;
  return {
    id: row.id, type: row.type, vendorId: row.vendorId, vendorName: vendorName ?? "",
    issuedAt: row.issuedAt, eventAt: row.eventAt, period: row.period, half: row.half,
    periodOverrideReason: row.periodOverrideReason,
    number: row.number, controlNumber: row.controlNumber, affectedDocumentId: row.affectedDocumentId,
    exempt: money(row.exemptCents), base16: money(row.base16Cents), base8: money(row.base8Cents),
    iva16: money(row.iva16Cents), iva8: money(row.iva8Cents), subtotal: money(row.subtotalCents),
    total: money(row.totalCents), ivaRetentionRate: row.ivaRetentionRate,
    ivaRetentionReason: row.ivaRetentionReason, ivaRetentionAmount: money(row.ivaRetentionCents),
    ivaCertificateNumber: row.ivaCertificateNumber,
    igtfApplies: row.igtfApplies, igtfBase: money(row.igtfBaseCents), igtfAmount: money(row.igtfAmountCents),
    islrApplies: row.islrApplies, islrConceptCode: row.islrConceptCode,
    islrManual: row.islrManual, islrManualReason: row.islrManualReason,
    islrBase: money(row.islrBaseCents), islrTaxableBase: money(row.islrTaxableBaseCents), islrRate: row.islrRate,
    islrSubtraction: money(row.islrSubtractionCents), islrAmount: money(row.islrRetentionCents),
    islrCertificateNumber: row.islrCertificateNumber,
    netPayable: money(row.netPayableCents), ceco: row.ceco,
    cecoAllocations: JSON.parse(row.cecoAllocations || "[]"), paymentAccountId: row.paymentAccountId,
    accountingSnapshot, historicalImport: accountingSnapshot?.historicalImport === true,
    description: row.description, status: row.status,
    attachmentName: row.attachmentName, hasAttachment: Boolean(row.attachmentName),
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export function assertOriginalCertificate(row: typeof documents.$inferSelect) {
  if (row.accountingSnapshot && JSON.parse(row.accountingSnapshot)?.historicalImport === true) {
    throw new InputError("Este comprobante fue importado: conserve y consulte el PDF original. La plataforma no recrea comprobantes históricos.");
  }
}

export async function findVendor(id: number) {
  const db = getDb();
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return vendor;
}
export async function findDocument(id: number) {
  const db = getDb();
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return doc;
}

export async function audit(entityType: string, entityId: number, action: string, snapshot: unknown) {
  const db = getDb();
  await db.insert(auditEvents).values({ entityType, entityId, action, snapshot: JSON.stringify(snapshot) });
}

export async function issueDocument(row: typeof documents.$inferSelect) {
  if (row.status === "issued") return row;
  if (row.status !== "draft") throw new InputError("Solo puede emitirse un documento en borrador");
  if (row.base16Cents === 0 && row.base8Cents === 0 && row.ivaRetentionCents !== 0) {
    throw new InputError("Una operación totalmente exenta no puede generar retención de IVA");
  }
  if (row.type !== "factura" && row.islrApplies) throw new InputError("La emisión de notas con ISLR está pendiente de validar su tratamiento en el portal; conserve la nota como borrador");
  const vendor = await findVendor(row.vendorId);
  if (!vendor) throw new InputError("El proveedor ya no existe");
  const settings = await readSettings();
  const allocations = JSON.parse(row.cecoAllocations || "[]") as { cecoId: number; percentage: number }[];
  const accounting = {
    description: row.description,
    cecos: allocations.map(allocation => {
      const ceco = settings.cecos.find(x => x.id === allocation.cecoId);
      if (!ceco) throw new InputError(`CECO ${allocation.cecoId} ya no existe`);
      return { id: ceco.id, code: ceco.code, name: ceco.name, percentage: allocation.percentage };
    }),
    paymentAccount: settings.paymentAccounts.find(x => x.id === row.paymentAccountId),
  };
  if (!accounting.paymentAccount) throw new InputError("La cuenta de pago ya no existe");
  const binding = getSqlite();
  binding.exec("BEGIN IMMEDIATE");
  try {
    const current = binding.prepare("SELECT status FROM documents WHERE id = ?").get(row.id) as { status: string } | undefined;
    if (current?.status !== "draft") throw new InputError("El documento ya fue emitido");
    for (const [kind, amount] of [["iva", row.ivaRetentionCents], ["islr", row.islrRetentionCents]] as const) {
      if (!amount) continue;
      const period = kind === "islr" ? row.eventAt.slice(0, 7) : row.period;
      const column = kind === "iva" ? "iva_certificate_number" : "islr_certificate_number";
      const certificate = reserveCertificateNumber(binding, kind, period);
      binding.prepare(`UPDATE documents SET ${column} = ? WHERE id = ?`).run(certificate, row.id);
    }
    binding.prepare("UPDATE documents SET status = 'issued', settings_snapshot = ?, accounting_snapshot = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(settings), JSON.stringify(accounting), new Date().toISOString(), row.id);
    binding.exec("COMMIT");
  } catch (error) { binding.exec("ROLLBACK"); throw error; }
  const issued = await findDocument(row.id);
  if (!issued) throw new Error("No se pudo recuperar el documento emitido");
  await audit("document", row.id, "issued", issued);
  return issued;
}
