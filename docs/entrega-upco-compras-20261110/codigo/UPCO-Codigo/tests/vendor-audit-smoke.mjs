import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditVendors, vendorAuditCsv } from '../lib/tax/vendorAudit.ts';

const imported = JSON.parse(readFileSync(new URL('../import/suppliers.json', import.meta.url), 'utf8'));
const rows = imported.map((supplier, index) => ({
  id: index + 1,
  rif: supplier.rif,
  name: supplier.name,
  address: supplier.address,
  taxpayerType: supplier.taxpayerType,
  personType: supplier.personType,
  residency: supplier.residency,
  ivaRetentionRate: supplier.ivaRetentionRate,
  needsReview: Object.keys(supplier.review || {}).length > 0,
  importReview: JSON.stringify(supplier.review || {}),
  importConfidence: supplier.confidence,
  sourceDate: supplier.sourceDate,
  sourcePdf: supplier.sourcePdf,
  usesFiscalMachine: false,
  fiscalMachineNumbers: '[]',
  active: true,
}));

const report = auditVendors(rows, new Date('2026-11-09T00:00:00Z'));
assert.equal(report.summary.total, 345);
assert.equal(report.summary.importedTotal, 345);
assert.equal(report.summary.importedPendingReview, 345);
assert.equal(report.summary.issueCounts.rif_format || 0, 0);
assert.equal(report.summary.issueCounts.name_missing || 0, 0);
assert.equal(report.summary.issueCounts.address_missing || 0, 0);
assert.equal(report.summary.issueCounts.person_rif_mismatch, 1);
assert.equal(report.summary.issueCounts.iva_rate_unverified, 12);
assert.equal(report.summary.issueCounts.name_multiple_rifs, 2);

const confirmed = auditVendors(rows.map(row => ({ ...row, needsReview: false })));
assert.equal(confirmed.summary.pendingFiscalReview, 0);
assert.equal(confirmed.summary.issueCounts.pending_fiscal_review || 0, 0);
assert.equal(confirmed.summary.issueCounts.taxpayer_unverified, 345);
assert.equal(confirmed.summary.issueCounts.iva_rate_unverified, 12);

const csv = vendorAuditCsv(report);
assert.equal(csv.split('\r\n').length, 347); // header, 345 data rows, trailing newline
const formula = vendorAuditCsv(auditVendors([{ ...rows[0], name: '=1+1' }]));
assert.match(formula, /"'=1\+1"/);
console.log('Auditoría de 345 proveedores y CSV: OK');
