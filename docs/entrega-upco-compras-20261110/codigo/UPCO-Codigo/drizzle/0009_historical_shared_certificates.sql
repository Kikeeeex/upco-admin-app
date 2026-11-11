-- One historical retention voucher can cover several invoices of the same
-- supplier. Application validation restricts that sharing to historical imports;
-- live issuance still reserves a free number inside a write transaction.
DROP INDEX IF EXISTS documents_iva_certificate_number_unique;
--> statement-breakpoint
DROP INDEX IF EXISTS documents_islr_certificate_number_unique;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS documents_iva_certificate_number_lookup
  ON documents(iva_certificate_number) WHERE iva_certificate_number <> '';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS documents_islr_certificate_number_lookup
  ON documents(islr_certificate_number) WHERE islr_certificate_number <> '';
