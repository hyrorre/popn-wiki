CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`body` text NOT NULL,
	`reply_to` integer,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`path` text NOT NULL,
	`revision` integer NOT NULL,
	`body` text NOT NULL,
	`message` text,
	`minor` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` integer NOT NULL,
	`updated_by` integer NOT NULL,
	PRIMARY KEY(`path`, `revision`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`avatar` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);