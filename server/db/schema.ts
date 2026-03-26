import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const pagesTable = sqliteTable('pages', {
  path: text().primaryKey().notNull(),
  revision: integer().notNull(),
  body: text(),
  message: text(),
  minor: integer(),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
  createdBy: text().notNull(),
  updatedBy: text().notNull()
})
