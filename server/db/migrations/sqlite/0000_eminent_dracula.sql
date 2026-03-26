CREATE TABLE `pages` (
	`path` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`body` text,
	`message` text,
	`minor` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL
);
