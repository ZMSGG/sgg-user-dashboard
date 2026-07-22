CREATE TABLE `discord_dm_challenges` (
	`challenge_id_digest` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`client_nonce_digest` text NOT NULL,
	`code_digest` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` text,
	CONSTRAINT "discord_dm_challenges_attempts_check" CHECK("discord_dm_challenges"."attempts" >= 0 AND "discord_dm_challenges"."attempts" <= 5)
);
--> statement-breakpoint
CREATE INDEX `discord_dm_challenges_discord_expires_idx` ON `discord_dm_challenges` (`discord_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `discord_dm_challenges_expires_at_idx` ON `discord_dm_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `discord_dm_rate_limits` (
	`scope` text NOT NULL,
	`subject_digest` text NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer NOT NULL,
	`last_attempt_at` integer NOT NULL,
	PRIMARY KEY(`scope`, `subject_digest`),
	CONSTRAINT "discord_dm_rate_limits_scope_check" CHECK("discord_dm_rate_limits"."scope" IN ('global', 'ip', 'discord')),
	CONSTRAINT "discord_dm_rate_limits_attempts_check" CHECK("discord_dm_rate_limits"."attempts" >= 1)
);
--> statement-breakpoint
CREATE INDEX `discord_dm_rate_limits_last_attempt_idx` ON `discord_dm_rate_limits` (`last_attempt_at`);--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `auth_method` text DEFAULT 'discord_oauth' NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `assurance_level` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
CREATE TRIGGER `auth_sessions_assurance_insert_check`
BEFORE INSERT ON `auth_sessions`
WHEN NOT (
	(NEW.`auth_method` = 'discord_oauth' AND NEW.`assurance_level` = 2)
	OR (NEW.`auth_method` = 'discord_dm' AND NEW.`assurance_level` = 1)
)
BEGIN
	SELECT RAISE(ABORT, 'invalid auth session assurance');
END;--> statement-breakpoint
CREATE TRIGGER `auth_sessions_assurance_update_check`
BEFORE UPDATE OF `auth_method`, `assurance_level` ON `auth_sessions`
WHEN NOT (
	(NEW.`auth_method` = 'discord_oauth' AND NEW.`assurance_level` = 2)
	OR (NEW.`auth_method` = 'discord_dm' AND NEW.`assurance_level` = 1)
)
BEGIN
	SELECT RAISE(ABORT, 'invalid auth session assurance');
END;
