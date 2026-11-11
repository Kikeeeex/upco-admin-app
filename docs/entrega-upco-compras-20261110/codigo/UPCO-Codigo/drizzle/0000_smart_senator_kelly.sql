CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`action` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `certificate_sequences` (
	`kind` text NOT NULL,
	`period` text NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificate_sequences_kind_period_unique` ON `certificate_sequences` (`kind`,`period`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text DEFAULT 'factura' NOT NULL,
	`vendor_id` integer NOT NULL,
	`issued_at` text NOT NULL,
	`event_at` text NOT NULL,
	`period` text NOT NULL,
	`half` integer NOT NULL,
	`period_override_reason` text DEFAULT '' NOT NULL,
	`number` text NOT NULL,
	`control_number` text DEFAULT '' NOT NULL,
	`affected_document_id` integer,
	`exempt_cents` integer DEFAULT 0 NOT NULL,
	`base16_cents` integer DEFAULT 0 NOT NULL,
	`base8_cents` integer DEFAULT 0 NOT NULL,
	`iva16_cents` integer DEFAULT 0 NOT NULL,
	`iva8_cents` integer DEFAULT 0 NOT NULL,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`iva_retention_rate` integer DEFAULT 75 NOT NULL,
	`iva_retention_reason` text DEFAULT '' NOT NULL,
	`iva_retention_cents` integer DEFAULT 0 NOT NULL,
	`iva_certificate_number` text DEFAULT '' NOT NULL,
	`igtf_applies` integer DEFAULT false NOT NULL,
	`igtf_base_cents` integer DEFAULT 0 NOT NULL,
	`islr_applies` integer DEFAULT false NOT NULL,
	`islr_concept_code` text DEFAULT '' NOT NULL,
	`islr_manual` integer DEFAULT false NOT NULL,
	`islr_manual_reason` text DEFAULT '' NOT NULL,
	`islr_base_cents` integer DEFAULT 0 NOT NULL,
	`islr_rate` real DEFAULT 0 NOT NULL,
	`islr_subtraction_cents` integer DEFAULT 0 NOT NULL,
	`islr_retention_cents` integer DEFAULT 0 NOT NULL,
	`islr_certificate_number` text DEFAULT '' NOT NULL,
	`net_payable_cents` integer DEFAULT 0 NOT NULL,
	`ceco` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_vendor_type_number_unique` ON `documents` (`vendor_id`,`type`,`number`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rif` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`taxpayer_type` text DEFAULT 'ordinario' NOT NULL,
	`person_type` text DEFAULT 'juridica' NOT NULL,
	`residency` text DEFAULT 'domiciliada' NOT NULL,
	`iva_retention_rate` integer DEFAULT 75 NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_rif_unique` ON `vendors` (`rif`);