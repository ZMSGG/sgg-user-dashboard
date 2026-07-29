CREATE TABLE `gacha_pulls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`pool_id` text NOT NULL,
	`card_id` text NOT NULL,
	`rarity` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `players`(`discord_id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gacha_pulls_idempotency_key_unique` ON `gacha_pulls` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `gacha_pulls_discord_created_idx` ON `gacha_pulls` (`discord_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `gacha_pulls_discord_card_idx` ON `gacha_pulls` (`discord_id`,`card_id`);--> statement-breakpoint
ALTER TABLE `point_grants` ADD `currency` text DEFAULT 'SGP' NOT NULL;--> statement-breakpoint
CREATE TRIGGER `point_grants_nonnegative_currency_balance`
BEFORE INSERT ON `point_grants`
WHEN NEW.`amount` < 0 AND (
	COALESCE((
		SELECT SUM(`amount`)
		FROM `point_grants`
		WHERE `discord_id` = NEW.`discord_id`
		  AND `currency` = NEW.`currency`
	), 0) + NEW.`amount`
) < 0
BEGIN
	SELECT RAISE(ABORT, 'SGG_INSUFFICIENT_CURRENCY_BALANCE');
END;
