ALTER TABLE documents ADD COLUMN igtf_amount_cents INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE documents
SET igtf_amount_cents = CASE
  WHEN igtf_applies = 1 THEN
    CASE WHEN igtf_base_cents < 0
      THEN -CAST(ABS(igtf_base_cents) * 3 / 100.0 + 0.5 AS INTEGER)
      ELSE CAST(igtf_base_cents * 3 / 100.0 + 0.5 AS INTEGER)
    END
  ELSE 0
END,
net_payable_cents = net_payable_cents + CASE
  WHEN igtf_applies = 1 THEN
    CASE WHEN igtf_base_cents < 0
      THEN -CAST(ABS(igtf_base_cents) * 3 / 100.0 + 0.5 AS INTEGER)
      ELSE CAST(igtf_base_cents * 3 / 100.0 + 0.5 AS INTEGER)
    END
  ELSE 0
END;
