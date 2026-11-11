CREATE TABLE released_certificate_numbers (
  kind TEXT NOT NULL,
  period TEXT NOT NULL,
  number INTEGER NOT NULL CHECK (number BETWEEN 1 AND 99999999),
  PRIMARY KEY (kind, period, number)
);
--> statement-breakpoint
CREATE TABLE retired_certificate_numbers (
  kind TEXT NOT NULL,
  period TEXT NOT NULL,
  number INTEGER NOT NULL CHECK (number BETWEEN 1 AND 99999999),
  PRIMARY KEY (kind, period, number)
);
--> statement-breakpoint
CREATE UNIQUE INDEX documents_iva_certificate_number_unique
  ON documents(iva_certificate_number) WHERE iva_certificate_number <> '';
--> statement-breakpoint
CREATE UNIQUE INDEX documents_islr_certificate_number_unique
  ON documents(islr_certificate_number) WHERE islr_certificate_number <> '';
