CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`subject` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`discord_username` text NOT NULL,
	`discord_global_name` text,
	`discord_avatar_hash` text,
	`wallet_address` text,
	`wallet_linked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_login_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_wallet_address_unique` ON `players` (`wallet_address`) WHERE wallet_address IS NOT NULL;--> statement-breakpoint
CREATE TABLE `point_grants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason_code` text NOT NULL,
	`note` text,
	`granted_by` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_grants_idempotency_key_unique` ON `point_grants` (`idempotency_key`);