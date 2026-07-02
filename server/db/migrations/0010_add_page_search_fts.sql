CREATE VIRTUAL TABLE `page_search_fts` USING fts5(
  `path`,
  `title`,
  `body`,
  `revision` UNINDEXED,
  `updated_at` UNINDEXED,
  tokenize = 'trigram'
);
