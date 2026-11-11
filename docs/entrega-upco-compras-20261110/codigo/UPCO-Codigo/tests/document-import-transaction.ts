import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_SETTINGS } from "../lib/tax/core";
import { IMPORT_HEADERS } from "../lib/tax/importSpreadsheet";

const directory = mkdtempSync(join(tmpdir(), "upco-import-transaction-"));
process.env.UPCO_DATA_DIR = directory;
let connection: DatabaseSync | undefined;
const settings = { ...DEFAULT_SETTINGS,
  cecos: [{ id: 1, code: "ADM", name: "Administración", active: true }],
  paymentAccounts: [{ id: 1, code: "B01", name: "Banco principal", active: true }],
};
const source = ["J123456789", "factura", "2026-11-08", "2026-11-09", "2026-11", "1", "F-1", "00-1", "", "0,00", "100,00", "0,00", "75", "12,00", "20261100002301", "", "", "", "", "", "Compra histórica de prueba", "B01", "ADM:100", "No", "0,00", "", ""];
const csv = (rows: string[][]) => new TextEncoder().encode([IMPORT_HEADERS.join(";"), ...rows.map(row => row.join(";"))].join("\r\n"));
const clone = (number: string, certificate: string) => { const row = [...source]; row[6] = number; row[7] = `C-${number}`; row[14] = certificate; return row; };

try {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
  const seed = new DatabaseSync(join(directory, "upco.sqlite"));
  seed.prepare("INSERT INTO vendors(rif,name,needs_review) VALUES(?,?,1)").run("J123456789", "PROVEEDOR DE PRUEBA");
  seed.close();
  const { importDocuments, inspectImportFile } = await import("../lib/tax/importDocuments");
  const { getSqlite } = await import("../db");
  const first = await importDocuments(csv([source]), "historico.csv", settings);
  assert.equal(first.imported, 1);
  const sqlite = getSqlite(); connection = sqlite;
  assert.equal((sqlite.prepare("SELECT count(*) total FROM documents").get() as { total: number }).total, 1);
  assert.equal(JSON.parse((sqlite.prepare("SELECT accounting_snapshot FROM documents WHERE number='F-1'").get() as { accounting_snapshot: string }).accounting_snapshot).historicalImport, true);
  assert.equal((sqlite.prepare("SELECT last_number FROM certificate_sequences WHERE kind='iva' AND period='*'").get() as { last_number: number }).last_number, 2301);
  assert.equal((sqlite.prepare("SELECT needs_review FROM vendors WHERE rif='J123456789'").get() as { needs_review: number }).needs_review, 1);
  const duplicate = await inspectImportFile(csv([source]), "historico.csv", settings);
  assert.equal(duplicate.summary.blocked, 1);
  await assert.rejects(importDocuments(csv([source]), "historico.csv", settings), /Importación detenida/);
  assert.equal((sqlite.prepare("SELECT count(*) total FROM documents").get() as { total: number }).total, 1);
  const repeatedSuffix = clone("F-DUP-MES", "20261200002301");
  repeatedSuffix[2] = "2026-12-01"; repeatedSuffix[3] = "2026-12-01"; repeatedSuffix[4] = "2026-12";
  const repeatedPreview = await inspectImportFile(csv([repeatedSuffix]), "otro-mes.csv", settings);
  assert.equal(repeatedPreview.summary.blocked, 1);
  assert.match(repeatedPreview.rows[0].issues.join(" "), /Correlativo IVA repetido/);

  const note = clone("NC-1", "20261100002302"); note[1] = "nota_credito"; note[8] = "F-1";
  const importedNote = await importDocuments(csv([note]), "nota.csv", settings);
  assert.equal(importedNote.imported, 1);
  const savedNote = sqlite.prepare("SELECT affected_document_id, iva_retention_cents FROM documents WHERE number='NC-1'").get() as { affected_document_id: number; iva_retention_cents: number };
  assert.equal(savedNote.affected_document_id, first.items[0].id);
  assert.equal(savedNote.iva_retention_cents, -1200);
  assert.equal((sqlite.prepare("SELECT last_number FROM certificate_sequences WHERE kind='iva' AND period='*'").get() as { last_number: number }).last_number, 2302);

  const partial = clone("F-ISLR", ""); partial[9] = "100,00"; partial[10] = "0,00"; partial[12] = "0"; partial[13] = "0,00";
  partial[15] = "004"; partial[16] = "100,00"; partial[17] = "5"; partial[18] = "1,50"; partial[19] = "20261100000936"; partial[25] = "40,00"; partial[26] = "0,50";
  assert.equal((await importDocuments(csv([partial]), "islr-parcial.csv", settings)).imported, 1);
  const savedPartial = sqlite.prepare("SELECT islr_base_cents, islr_taxable_base_cents, islr_subtraction_cents, islr_retention_cents FROM documents WHERE number='F-ISLR'").get() as { islr_base_cents: number; islr_taxable_base_cents: number; islr_subtraction_cents: number; islr_retention_cents: number };
  assert.deepEqual({ ...savedPartial }, { islr_base_cents: 10000, islr_taxable_base_cents: 4000, islr_subtraction_cents: 50, islr_retention_cents: 150 });
  assert.equal((sqlite.prepare("SELECT last_number FROM certificate_sequences WHERE kind='islr' AND period='*'").get() as { last_number: number }).last_number, 936);

  sqlite.exec("CREATE TRIGGER import_rollback BEFORE INSERT ON documents WHEN NEW.number = 'F-TRIGGER' BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
  await assert.rejects(importDocuments(csv([clone("F-2", "20261100002303"), clone("F-TRIGGER", "20261100002304")]), "rollback.csv", settings), /test rollback/);
  assert.equal((sqlite.prepare("SELECT count(*) total FROM documents").get() as { total: number }).total, 3);
  assert.equal((sqlite.prepare("SELECT last_number FROM certificate_sequences WHERE kind='iva' AND period='*'").get() as { last_number: number }).last_number, 2302);
} finally {
  try { connection?.close(); } catch { /* already closed */ }
  const absolute = resolve(directory), temp = realpathSync(tmpdir());
  if (!absolute.startsWith(temp + "\\") && !absolute.startsWith(temp + "/")) throw new Error("Directorio temporal fuera de la carpeta esperada");
  try { rmSync(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch { /* Windows can release SQLite files after this process exits. */ }
}
