CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`discord_id`) REFERENCES `players`(`discord_id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_discord_id_idx` ON `auth_sessions` (`discord_id`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expires_at_idx` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `wallet_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`discord_id` text NOT NULL,
	`address` text NOT NULL,
	`nonce` text NOT NULL,
	`origin` text NOT NULL,
	`issued_at` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `auth_sessions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`discord_id`) REFERENCES `players`(`discord_id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `wallet_challenges_session_id_idx` ON `wallet_challenges` (`session_id`);--> statement-breakpoint
CREATE INDEX `wallet_challenges_discord_id_idx` ON `wallet_challenges` (`discord_id`);--> statement-breakpoint
CREATE INDEX `wallet_challenges_expires_at_idx` ON `wallet_challenges` (`expires_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_point_grants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason_code` text NOT NULL,
	`note` text,
	`granted_by` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_fingerprint` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `players`(`discord_id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`granted_by`) REFERENCES `players`(`discord_id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_point_grants`("id", "discord_id", "amount", "reason_code", "note", "granted_by", "idempotency_key", "request_fingerprint", "created_at") SELECT "id", "discord_id", "amount", "reason_code", "note", "granted_by", "idempotency_key", '', "created_at" FROM `point_grants`;--> statement-breakpoint
DROP TABLE `point_grants`;--> statement-breakpoint
ALTER TABLE `__new_point_grants` RENAME TO `point_grants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `point_grants_idempotency_key_unique` ON `point_grants` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `point_grants_discord_created_idx` ON `point_grants` (`discord_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `point_grants_granted_by_created_idx` ON `point_grants` (`granted_by`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_created_idx` ON `audit_events` (`actor`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_subject_created_idx` ON `audit_events` (`subject`,`created_at`);--> statement-breakpoint
CREATE INDEX `players_last_login_at_idx` ON `players` (`last_login_at`);
