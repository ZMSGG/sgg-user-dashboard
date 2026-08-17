CREATE TABLE `tournament_results` (
	`tournament_id` text NOT NULL,
	`season_id` text NOT NULL,
	`discord_id` text NOT NULL,
	`rank` integer NOT NULL,
	`score` integer NOT NULL,
	`sgp_amount` integer NOT NULL,
	`breakdown` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`tournament_id`, `discord_id`)
);
--> statement-breakpoint
CREATE INDEX `tournament_results_discord_idx` ON `tournament_results` (`discord_id`);