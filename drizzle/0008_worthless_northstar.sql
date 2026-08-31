ALTER TABLE `tournament_results` ADD `grant_idempotency_key` text;--> statement-breakpoint
-- Rows imported before this column existed were all paid under the old
-- season-based convention; record that explicitly so the join never has to
-- guess again.
UPDATE `tournament_results`
SET `grant_idempotency_key` = 'tournament:' || `season_id` || ':' || `discord_id`
WHERE `grant_idempotency_key` IS NULL;
