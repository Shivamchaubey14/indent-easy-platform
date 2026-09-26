CREATE TABLE `mutation_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`depends_on` text,
	`state` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mutation_queue_idempotency_key_unique` ON `mutation_queue` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `mutation_queue_state_created_idx` ON `mutation_queue` (`state`,`created_at`);--> statement-breakpoint
CREATE TABLE `sync_cursor` (
	`entity` text PRIMARY KEY NOT NULL,
	`cursor` text NOT NULL,
	`updated_at` integer NOT NULL
);
