CREATE INDEX `comments_reply_idx` ON `comments` (`reply_to`,`path`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `comments_user_recent_idx` ON `comments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_roots_recent_idx` ON `comments` (`path`,`created_at`,`id`) WHERE "comments"."deleted_at" IS NULL AND "comments"."reply_to" IS NULL;--> statement-breakpoint
CREATE INDEX `pages_major_path_idx` ON `pages` (`path`,`revision`) WHERE "pages"."body" != '' AND ("pages"."minor" IS NULL OR "pages"."minor" = 0);--> statement-breakpoint
CREATE INDEX `pages_deleted_path_idx` ON `pages` (`path`,`revision`) WHERE "pages"."body" = '';