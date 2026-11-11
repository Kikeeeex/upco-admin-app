ALTER TABLE `documents` ADD `attachment_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `attachment_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `attachment_size` integer DEFAULT 0 NOT NULL;