ALTER TABLE vendors ADD COLUMN uses_fiscal_machine INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE vendors ADD COLUMN fiscal_machine_numbers TEXT NOT NULL DEFAULT '[]';
