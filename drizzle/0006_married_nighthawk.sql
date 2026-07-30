CREATE TABLE `holdings_token_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wallet_address` text NOT NULL,
	`collection_id` text NOT NULL,
	`offset` integer NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holdings_token_cache_key_idx` ON `holdings_token_cache` (`wallet_address`,`collection_id`,`offset`);