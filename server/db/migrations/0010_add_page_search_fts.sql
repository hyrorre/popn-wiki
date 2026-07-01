CREATE VIRTUAL TABLE `page_search_fts` USING fts5(
  `path`,
  `title`,
  `body`,
  `revision` UNINDEXED,
  `updated_at` UNINDEXED,
  tokenize = 'trigram'
);
--> statement-breakpoint
INSERT INTO `page_search_fts` (`path`, `title`, `body`, `revision`, `updated_at`)
SELECT `pages`.`path`, `pages`.`title`, `pages`.`body`, `pages`.`revision`, `pages`.`updated_at`
FROM `pages`
WHERE `pages`.`body` != ''
  AND NOT EXISTS (
    SELECT 1
    FROM `pages` AS `newer_revision`
    WHERE `newer_revision`.`path` = `pages`.`path`
      AND `newer_revision`.`revision` > `pages`.`revision`
  );
