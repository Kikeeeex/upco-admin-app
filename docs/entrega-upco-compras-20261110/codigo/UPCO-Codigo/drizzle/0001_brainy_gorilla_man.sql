ALTER TABLE `documents` ADD `islr_taxable_base_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `settings_snapshot` text DEFAULT '' NOT NULL;