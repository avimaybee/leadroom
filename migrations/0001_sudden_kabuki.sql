CREATE TABLE `candidate_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`discovery_scope_id` text,
	`raw_name` text NOT NULL,
	`raw_website_url` text,
	`raw_contact_info` text,
	`raw_location` text,
	`notes` text,
	`status` text DEFAULT 'NEW' NOT NULL,
	`promoted_lead_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`discovery_scope_id`) REFERENCES `discovery_scopes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `discovery_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`industry_filter` text,
	`geography_filter` text,
	`company_size_filter` text,
	`business_type_filter` text,
	`digital_presence_filter` text,
	`notes` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
