import { getDb, getSqlite } from "@/db";
import { documents, vendors } from "@/db/schema";
import { fail, type TaxSettings } from "./core";
import { readImportSpreadsheet } from "./importSpreadsheet";
import { inspectRows, normalize } from "./importDocumentPreview";
export async function inspectImportFile(data: Uint8Array, fileName: string, settings: TaxSettings) {
  const rawRows = readImportSpreadsheet(data, fileName);
  const db = getDb();
  const vendorRows = await db.select().from(vendors);
  const existing = await db.select().from(documents);
  return inspectRows(rawRows, vendorRows, existing, settings);
}

export async function importDocuments(data: Uint8Array, fileName: string, settings: TaxSettings) {
  const rawRows = readImportSpreadsheet(data, fileName);
  const db = getDb();
  const vendorRows = await db.select().from(vendors);
  const existing = await db.select().from(documents);
  const inspected = inspectRows(rawRows, vendorRows, existing, settings);
  if (!inspected.summary.total) fail("La plantilla no contiene documentos");
  if (inspected.summary.blocked) fail(`Importación detenida: ${inspected.summary.blocked} fila(s) con observaciones. Revise la vista previa y corrija el archivo.`);
  const sqlite = getSqlite();
  const fields = ["type", "vendor_id", "issued_at", "event_at", "period", "half", "period_override_reason", "number", "control_number", "affected_document_id", "exempt_cents", "base16_cents", "base8_cents", "iva16_cents", "iva8_cents", "subtotal_cents", "total_cents", "iva_retention_rate", "iva_retention_reason", "iva_retention_cents", "iva_certificate_number", "igtf_applies", "igtf_base_cents", "igtf_amount_cents", "islr_applies", "islr_concept_code", "islr_manual", "islr_manual_reason", "islr_base_cents", "islr_taxable_base_cents", "islr_rate", "islr_subtraction_cents", "islr_retention_cents", "islr_certificate_number", "settings_snapshot", "net_payable_cents", "ceco", "ceco_allocations", "payment_account_id", "accounting_snapshot", "description", "status"];
  const insert = sqlite.prepare(`INSERT INTO documents (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`);
  const isHistorical = (snapshot: string) => {
    try { return JSON.parse(snapshot || "{}").historicalImport === true; }
    catch { return false; }
  };
  const inserted = new Map<string, number>();
  const items: { id: number; number: string; rif: string }[] = [];
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    // Validate again under the write lock, including duplicate certificate numbers.
    for (const item of inspected.prepared) {
      const duplicate = sqlite.prepare("SELECT id FROM documents WHERE vendor_id = ? AND type = ? AND upper(number) = ?").get(item.vendorId, item.values.type, normalize(item.values.number));
      if (duplicate) fail(`Documento ${item.values.number} fue registrado por otro usuario; vuelva a revisar la importación`);
      for (const [column, number] of [["iva_certificate_number", item.ivaCertificate], ["islr_certificate_number", item.islrCertificate]]) {
        if (!number) continue;
        const matches = sqlite.prepare(`SELECT vendor_id, accounting_snapshot FROM documents WHERE ${column} = ?`).all(number) as { vendor_id: number; accounting_snapshot: string }[];
        if (matches.some(match => match.vendor_id !== item.vendorId || !isHistorical(match.accounting_snapshot)))
          fail(`Comprobante ${number} ya fue registrado por otro proveedor o documento no histórico`);
      }
    }
    const invoiceFirst = [...inspected.prepared].sort((a, b) => (a.values.type === "factura" ? 0 : 1) - (b.values.type === "factura" ? 0 : 1) || a.sourceRow - b.sourceRow);
    for (const item of invoiceFirst) {
      const v = item.values;
      let affectedId: number | null = null;
      if (v.type !== "factura") {
        affectedId = inserted.get(`${item.vendorId}|${normalize(item.affectedNumber)}`) ??
          (sqlite.prepare("SELECT id FROM documents WHERE vendor_id = ? AND type = 'factura' AND status = 'issued' AND upper(number) = ? LIMIT 1").get(item.vendorId, normalize(item.affectedNumber)) as { id: number } | undefined)?.id ?? null;
        if (!affectedId) fail(`Factura afectada ${item.affectedNumber} ya no está disponible`);
      }
      const accounting = { historicalImport: true, description: v.description,
        cecos: JSON.parse(v.cecoAllocations).map((allocation: { cecoId: number; percentage: number }) => {
          const ceco = settings.cecos.find(value => value.id === allocation.cecoId)!;
          return { id: ceco.id, code: ceco.code, name: ceco.name, percentage: allocation.percentage };
        }), paymentAccount: settings.paymentAccounts.find(value => value.id === v.paymentAccountId) };
      const values = [v.type, item.vendorId, v.issuedAt, v.eventAt, v.period, v.half, v.periodOverrideReason, v.number, v.controlNumber, affectedId,
        v.exemptCents, v.base16Cents, v.base8Cents, v.iva16Cents, v.iva8Cents, v.subtotalCents, v.totalCents,
        v.ivaRetentionRate, v.ivaRetentionReason, v.ivaRetentionCents, item.ivaCertificate, Number(v.igtfApplies), v.igtfBaseCents, v.igtfAmountCents,
        Number(v.islrApplies), v.islrConceptCode, Number(v.islrManual), v.islrManualReason, v.islrBaseCents, v.islrTaxableBaseCents,
        v.islrRate, v.islrSubtractionCents, v.islrRetentionCents, item.islrCertificate, JSON.stringify(settings), v.netPayableCents,
        v.ceco, v.cecoAllocations, v.paymentAccountId, JSON.stringify(accounting), v.description, "issued"];
      const created = insert.run(...values);
      const id = Number(created.lastInsertRowid);
      if (v.type === "factura") inserted.set(`${item.vendorId}|${normalize(v.number)}`, id);
      sqlite.prepare("INSERT INTO audit_events(entity_type,entity_id,action,snapshot) VALUES('document',?,'historical_import',?)")
        .run(id, JSON.stringify({ sourceFile: fileName, sourceRow: item.sourceRow, number: v.number, rif: item.rif, ivaCertificate: item.ivaCertificate, islrCertificate: item.islrCertificate }));
      for (const [kind, number] of [["iva", item.ivaCertificate], ["islr", item.islrCertificate]]) {
        if (!number) continue;
        const sequence = Number(number.slice(6));
        const column = kind === "iva" ? "iva_certificate_number" : "islr_certificate_number";
        const sameSuffix = sqlite.prepare(`SELECT vendor_id, ${column} AS certificate, accounting_snapshot FROM documents WHERE id <> ? AND length(${column}) = 14 AND substr(${column}, 7) = ?`)
          .all(id, String(sequence).padStart(8, "0")) as { vendor_id: number; certificate: string; accounting_snapshot: string }[];
        if (sameSuffix.some(previous => previous.vendor_id !== item.vendorId || previous.certificate !== number || !isHistorical(previous.accounting_snapshot)))
          fail(`El correlativo ${kind.toUpperCase()} ${sequence} ya está registrado por otro proveedor, mes o documento no histórico`);
        sqlite.prepare("INSERT INTO certificate_sequences(kind,period,last_number) VALUES(?,?,?) ON CONFLICT(kind,period) DO UPDATE SET last_number = max(last_number, excluded.last_number)")
          .run(kind, "*", sequence);
        sqlite.prepare("DELETE FROM released_certificate_numbers WHERE kind = ? AND number = ?").run(kind, sequence);
        sqlite.prepare("DELETE FROM retired_certificate_numbers WHERE kind = ? AND number = ?").run(kind, sequence);
      }
      items.push({ id, number: v.number, rif: item.rif });
    }
    sqlite.exec("COMMIT");
  } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  return { imported: items.length, items };
}
