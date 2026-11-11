import type { DatabaseSync } from "node:sqlite";
import { InputError } from "./core";

export type CertificateKind = "iva" | "islr";

const certificateColumn = (kind: CertificateKind) => kind === "iva" ? "iva_certificate_number" : "islr_certificate_number";
const GLOBAL_SEQUENCE = "*";

function parseCertificateNumber(certificate: string) {
  if (!/^\d{14}$/.test(certificate)) return null;
  const period = `${certificate.slice(0, 4)}-${certificate.slice(4, 6)}`;
  const number = Number(certificate.slice(6));
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && number > 0 ? { period, number } : null;
}

export function formatCertificateNumber(period: string, number: number) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || !Number.isInteger(number) || number < 1 || number > 99_999_999) {
    throw new InputError("Período o correlativo de comprobante inválido");
  }
  return `${period.replace("-", "")}${String(number).padStart(8, "0")}`;
}

/** Read the next number without reserving it. Callers must label this as a preview. */
export function nextCertificateNumber(db: DatabaseSync, kind: CertificateKind, period: string) {
  const sequence = db.prepare("SELECT last_number FROM certificate_sequences WHERE kind = ? AND period = ?")
    .get(kind, GLOBAL_SEQUENCE) as { last_number: number } | undefined;
  if (!sequence) return null;
  const column = certificateColumn(kind);
  const released = db.prepare(`
    SELECT free.number FROM released_certificate_numbers free
    WHERE free.kind = ?
      AND NOT EXISTS (
        SELECT 1 FROM documents used
        WHERE length(used.${column}) = 14
          AND substr(used.${column}, 7) = printf('%08d', free.number)
      )
      AND NOT EXISTS (
        SELECT 1 FROM retired_certificate_numbers retired
        WHERE retired.kind = free.kind AND retired.number = free.number
      )
    ORDER BY free.number, free.period LIMIT 1
  `).get(kind) as { number: number } | undefined;
  if (released) return { number: released.number, released: true as const };

  let number = sequence.last_number + 1;
  const occupied = db.prepare(`SELECT 1 FROM documents WHERE length(${column}) = 14 AND substr(${column}, 7) = ? LIMIT 1`);
  const retired = db.prepare("SELECT 1 FROM retired_certificate_numbers WHERE kind = ? AND number = ? LIMIT 1");
  while (number <= 99_999_999 && (occupied.get(String(number).padStart(8, "0")) || retired.get(kind, number))) number += 1;
  if (number > 99_999_999) throw new InputError(`Se agotaron los correlativos ${kind.toUpperCase()}`);
  return { number, released: false as const };
}

/** Reserve inside the caller's write transaction, so two emissions cannot take the same gap. */
export function reserveCertificateNumber(db: DatabaseSync, kind: CertificateKind, period: string) {
  const next = nextCertificateNumber(db, kind, period);
  if (!next) throw new InputError(`Falta inicializar el correlativo continuo ${kind.toUpperCase()}; actualice la base de datos antes de emitir`);
  if (next.released) {
    const result = db.prepare("DELETE FROM released_certificate_numbers WHERE kind = ? AND number = ?")
      .run(kind, next.number);
    if (result.changes < 1) throw new InputError("El correlativo liberado cambió; vuelva a intentar la emisión");
  } else {
    db.prepare("UPDATE certificate_sequences SET last_number = ? WHERE kind = ? AND period = ?")
      .run(next.number, kind, GLOBAL_SEQUENCE);
  }
  return formatCertificateNumber(period, next.number);
}

/** Make only a number from a deleted document reusable, never an unknown historical gap. */
export function releaseCertificateNumber(db: DatabaseSync, kind: CertificateKind, certificate: string) {
  const parsed = parseCertificateNumber(certificate);
  if (!parsed) return false;
  const { period, number } = parsed;
  const sequence = db.prepare("SELECT 1 FROM certificate_sequences WHERE kind = ? AND period = ?").get(kind, GLOBAL_SEQUENCE);
  if (!sequence) return false;
  if (db.prepare("SELECT 1 FROM retired_certificate_numbers WHERE kind = ? AND number = ?").get(kind, number)) return false;
  const column = certificateColumn(kind);
  const stillUsed = db.prepare(`SELECT 1 FROM documents WHERE length(${column}) = 14 AND substr(${column}, 7) = ? LIMIT 1`)
    .get(String(number).padStart(8, "0"));
  if (stillUsed) return false;
  db.prepare("UPDATE certificate_sequences SET last_number = max(last_number, ?) WHERE kind = ? AND period = ?")
    .run(number, kind, GLOBAL_SEQUENCE);
  db.prepare("INSERT OR IGNORE INTO released_certificate_numbers(kind, period, number) VALUES (?, ?, ?)")
    .run(kind, period, number);
  return true;
}

/** Preserve numbers from deleted historical imports, which were issued outside this app. */
export function retireCertificateNumber(db: DatabaseSync, kind: CertificateKind, certificate: string) {
  const parsed = parseCertificateNumber(certificate);
  if (!parsed) return false;
  const { period, number } = parsed;
  db.prepare("DELETE FROM released_certificate_numbers WHERE kind = ? AND number = ?").run(kind, number);
  db.prepare("INSERT OR IGNORE INTO retired_certificate_numbers(kind, period, number) VALUES (?, ?, ?)").run(kind, period, number);
  db.prepare("UPDATE certificate_sequences SET last_number = max(last_number, ?) WHERE kind = ? AND period = ?")
    .run(number, kind, GLOBAL_SEQUENCE);
  return true;
}
