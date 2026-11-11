ALTER TABLE vendors ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE vendors ADD COLUMN import_confidence TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE vendors ADD COLUMN import_review TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE vendors ADD COLUMN source_date TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE vendors ADD COLUMN source_pdf TEXT NOT NULL DEFAULT '';
