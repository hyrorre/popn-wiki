import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core'

export const pagesTable = sqliteTable('pages', {
  path: text().notNull(),
  revision: integer().notNull(),
  body: text().notNull(),
  message: text(),
  minor: integer(),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
  createdBy: text().notNull(),
  updatedBy: text().notNull(),
}, (table) => {
  return [
    primaryKey({ columns: [table.path, table.revision] })
  ]
})

export const profilesTable = sqliteTable('profiles', {
  id: text().primaryKey().notNull(),
  name: text(),
  avatar: text(),
  createdAt: text().notNull(),
  updatedAt: text().notNull()
})

export const commentsTable = sqliteTable('comments', {
  id: integer().primaryKey({ autoIncrement: true }),
  path: text().notNull(),
  body: text().notNull(),
  replyTo: integer(),
  userId: text().notNull(),
  createdAt: text().notNull(),
  updatedAt: text().notNull()
})
export const usersTable = sqliteTable('users', {
  id: text().primaryKey().notNull(),
  email: text().notNull().unique(),
  password: text().notNull(),
  name: text(),
  avatar: text(),
  createdAt: text().notNull(),
  updatedAt: text().notNull()
})
