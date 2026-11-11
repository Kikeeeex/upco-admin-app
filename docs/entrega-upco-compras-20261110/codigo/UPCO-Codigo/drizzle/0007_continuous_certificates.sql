-- The month remains in the printed certificate. The eight-digit suffix is
-- continuous across months for each tax, including numbers already issued.
-- 2293/932 are the last valid historical numbers in import/certificate_maxima.json
-- before this system started issuing November 2026 certificates.
INSERT INTO certificate_sequences(kind, period, last_number)
SELECT 'iva', '*', max(
  2293,
  coalesce((SELECT max(last_number) FROM certificate_sequences
    WHERE kind = 'iva' AND length(period) = 7 AND substr(period, 6, 2) BETWEEN '01' AND '12'), 0),
  coalesce((SELECT max(CAST(substr(iva_certificate_number, 7) AS INTEGER)) FROM documents
    WHERE length(iva_certificate_number) = 14 AND substr(iva_certificate_number, 5, 2) BETWEEN '01' AND '12'), 0),
  coalesce((SELECT max(number) FROM released_certificate_numbers WHERE kind = 'iva'), 0),
  coalesce((SELECT max(number) FROM retired_certificate_numbers WHERE kind = 'iva'), 0)
)
ON CONFLICT(kind, period) DO UPDATE SET last_number = max(last_number, excluded.last_number);
--> statement-breakpoint
INSERT INTO certificate_sequences(kind, period, last_number)
SELECT 'islr', '*', max(
  932,
  coalesce((SELECT max(last_number) FROM certificate_sequences
    WHERE kind = 'islr' AND length(period) = 7 AND substr(period, 6, 2) BETWEEN '01' AND '12'), 0),
  coalesce((SELECT max(CAST(substr(islr_certificate_number, 7) AS INTEGER)) FROM documents
    WHERE length(islr_certificate_number) = 14 AND substr(islr_certificate_number, 5, 2) BETWEEN '01' AND '12'), 0),
  coalesce((SELECT max(number) FROM released_certificate_numbers WHERE kind = 'islr'), 0),
  coalesce((SELECT max(number) FROM retired_certificate_numbers WHERE kind = 'islr'), 0)
)
ON CONFLICT(kind, period) DO UPDATE SET last_number = max(last_number, excluded.last_number);
