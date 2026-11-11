import type { DatabaseSync } from "node:sqlite";
import { InputError } from "./core";
import { releaseCertificateNumber } from "./certificateSequences";

type StoredDocument = {
  id: number;
  status: string;
  iva_certificate_number: string;
  islr_certificate_number: string;
  accounting_snapshot: string;
  [key: string]: unknown;
};

/** Anulaciones y liberaciones se confirman juntas para no perder un correlativo. */
export function voidIssuedDocument(db: DatabaseSync, id: number) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const before = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as StoredDocument | undefined;
    if (!before || before.status !== "issued") throw new InputError("El documento ya no está emitido");
    const linked = db.prepare("SELECT number FROM documents WHERE affected_document_id = ? AND status <> 'void' LIMIT 1")
      .get(id) as { number: string } | undefined;
    if (linked) throw new InputError(`No se puede anular esta factura porque tiene la nota ${linked.number} asociada`);

    const historicalImport = Boolean(before.accounting_snapshot && JSON.parse(before.accounting_snapshot)?.historicalImport === true);
    const updatedAt = new Date().toISOString();
    const result = historicalImport
      ? db.prepare("UPDATE documents SET status = 'void', updated_at = ? WHERE id = ? AND status = 'issued'").run(updatedAt, id)
      : db.prepare("UPDATE documents SET status = 'void', iva_certificate_number = '', islr_certificate_number = '', updated_at = ? WHERE id = ? AND status = 'issued'").run(updatedAt, id);
    if (result.changes !== 1) throw new InputError("El documento cambió durante la anulación");

    const released: { iva: string | null; islr: string | null } = { iva: null, islr: null };
    if (!historicalImport) {
      for (const [kind, certificate] of [["iva", before.iva_certificate_number], ["islr", before.islr_certificate_number]] as const) {
        if (!certificate) continue;
        if (!releaseCertificateNumber(db, kind, certificate)) {
          throw new InputError(`No se pudo liberar el comprobante ${kind.toUpperCase()} ${certificate}; la anulación se canceló`);
        }
        released[kind] = certificate;
      }
    }

    const after = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
    db.prepare("INSERT INTO audit_events (entity_type, entity_id, action, snapshot) VALUES ('document', ?, 'voided', ?)")
      .run(id, JSON.stringify({ before, after, released, historicalImport }));
    db.exec("COMMIT");
    return { released, historicalImport };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
