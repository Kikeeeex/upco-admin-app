import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const vendors = sqliteTable("vendors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rif: text("rif").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  taxpayerType: text("taxpayer_type").notNull().default("ordinario"),
  personType: text("person_type").notNull().default("juridica"),
  residency: text("residency").notNull().default("domiciliada"),
  ivaRetentionRate: integer("iva_retention_rate").notNull().default(75),
  usesFiscalMachine: integer("uses_fiscal_machine", { mode: "boolean" }).notNull().default(false),
  fiscalMachineNumbers: text("fiscal_machine_numbers").notNull().default("[]"),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
  importConfidence: text("import_confidence").notNull().default(""),
  importReview: text("import_review").notNull().default(""),
  sourceDate: text("source_date").notNull().default(""),
  sourcePdf: text("source_pdf").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("vendors_rif_unique").on(t.rif)]);

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull().default("factura"),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  issuedAt: text("issued_at").notNull(),
  eventAt: text("event_at").notNull(),
  period: text("period").notNull(),
  half: integer("half").notNull(),
  periodOverrideReason: text("period_override_reason").notNull().default(""),
  number: text("number").notNull(),
  controlNumber: text("control_number").notNull().default(""),
  affectedDocumentId: integer("affected_document_id"),
  exemptCents: integer("exempt_cents").notNull().default(0),
  base16Cents: integer("base16_cents").notNull().default(0),
  base8Cents: integer("base8_cents").notNull().default(0),
  iva16Cents: integer("iva16_cents").notNull().default(0),
  iva8Cents: integer("iva8_cents").notNull().default(0),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  ivaRetentionRate: integer("iva_retention_rate").notNull().default(75),
  ivaRetentionReason: text("iva_retention_reason").notNull().default(""),
  ivaRetentionCents: integer("iva_retention_cents").notNull().default(0),
  ivaCertificateNumber: text("iva_certificate_number").notNull().default(""),
  igtfApplies: integer("igtf_applies", { mode: "boolean" }).notNull().default(false),
  igtfBaseCents: integer("igtf_base_cents").notNull().default(0),
  igtfAmountCents: integer("igtf_amount_cents").notNull().default(0),
  islrApplies: integer("islr_applies", { mode: "boolean" }).notNull().default(false),
  islrConceptCode: text("islr_concept_code").notNull().default(""),
  islrManual: integer("islr_manual", { mode: "boolean" }).notNull().default(false),
  islrManualReason: text("islr_manual_reason").notNull().default(""),
  islrBaseCents: integer("islr_base_cents").notNull().default(0),
  islrTaxableBaseCents: integer("islr_taxable_base_cents").notNull().default(0),
  islrRate: real("islr_rate").notNull().default(0),
  islrSubtractionCents: integer("islr_subtraction_cents").notNull().default(0),
  islrRetentionCents: integer("islr_retention_cents").notNull().default(0),
  islrCertificateNumber: text("islr_certificate_number").notNull().default(""),
  settingsSnapshot: text("settings_snapshot").notNull().default(""),
  attachmentName: text("attachment_name").notNull().default(""),
  attachmentType: text("attachment_type").notNull().default(""),
  attachmentSize: integer("attachment_size").notNull().default(0),
  netPayableCents: integer("net_payable_cents").notNull().default(0),
  ceco: text("ceco").notNull().default(""),
  cecoAllocations: text("ceco_allocations").notNull().default("[]"),
  paymentAccountId: integer("payment_account_id"),
  accountingSnapshot: text("accounting_snapshot").notNull().default(""),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("documents_vendor_type_number_unique").on(t.vendorId, t.type, t.number)]);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const certificateSequences = sqliteTable("certificate_sequences", {
  kind: text("kind").notNull(),
  period: text("period").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
}, (t) => [uniqueIndex("certificate_sequences_kind_period_unique").on(t.kind, t.period)]);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  role: text("role").notNull().default("operator"),
  permissions: text("permissions").notNull().default("[]"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
