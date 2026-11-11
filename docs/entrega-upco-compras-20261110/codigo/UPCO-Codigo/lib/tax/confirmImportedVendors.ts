import type { DatabaseSync } from "node:sqlite";

export class ImportConfirmationError extends Error {}

/** Records a user's internal confirmation; this never queries SENIAT or changes supplier fields. */
export function confirmImportedVendors(sqlite: DatabaseSync, expectedPending: number) {
  if (!Number.isInteger(expectedPending) || expectedPending < 1) throw new ImportConfirmationError("Actualiza primero el diagnóstico de proveedores");
  let transaction = false;
  try {
    sqlite.exec("BEGIN IMMEDIATE");
    transaction = true;
    const imported = sqlite.prepare("SELECT COUNT(*) AS total FROM vendors WHERE TRIM(import_confidence) <> ''").get() as { total: number };
    const pending = sqlite.prepare("SELECT id FROM vendors WHERE TRIM(import_confidence) <> '' AND needs_review = 1 ORDER BY id").all() as Array<{ id: number }>;
    if (pending.length !== expectedPending) throw new ImportConfirmationError("El directorio cambió desde la revisión. Vuelve a revisar antes de confirmar");
    const changed = sqlite.prepare("UPDATE vendors SET needs_review = 0, updated_at = ? WHERE TRIM(import_confidence) <> '' AND needs_review = 1")
      .run(new Date().toISOString());
    if (changed.changes !== pending.length) throw new Error("La confirmación masiva no actualizó todas las fichas");
    sqlite.prepare("INSERT INTO audit_events(entity_type, entity_id, action, snapshot) VALUES('vendor', 0, 'bulk_fiscal_review_confirmed', ?)")
      .run(JSON.stringify({ count: pending.length, imported: imported.total, vendorIds: pending.map(row => row.id), method: "user-confirmed-internal-review", officialSeniatCheck: false }));
    sqlite.exec("COMMIT");
    transaction = false;
    return { updated: pending.length, imported: imported.total, officialSeniatCheck: false };
  } catch (error) {
    if (transaction) sqlite.exec("ROLLBACK");
    throw error;
  }
}
