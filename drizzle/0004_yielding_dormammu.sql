CREATE TABLE `game_account_links` (
	`game_id` text NOT NULL,
	`discord_id` text NOT NULL,
	`link_code` text NOT NULL,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`game_player_id` text,
	`verified_at` text,
	`verified_season_id` text,
	PRIMARY KEY(`game_id`, `discord_id`),
	FOREIGN KEY (`discord_id`) REFERENCES `players`(`discord_id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_account_links_code_unique` ON `game_account_links` (`game_id`,`link_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_account_links_game_player_unique` ON `game_account_links` (`game_id`,`game_player_id`) WHERE game_player_id IS NOT NULL;