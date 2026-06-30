ALTER TABLE `discovery_scopes` ADD `workspace_id` text REFERENCES workspaces(id);--> statement-breakpoint
ALTER TABLE `discovery_scopes` ADD `market_id` text REFERENCES markets(id);