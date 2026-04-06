import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core'

export const usersTable = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  email: text().notNull().unique(),
  password: text().notNull(),
  avatar: text(),
  createdAt: text().notNull(),
  updatedAt: text().notNull()
})

export const pagesTable = sqliteTable(
  'pages',
  {
    path: text().notNull(),
    revision: integer().notNull(),
    body: text().notNull(),
    message: text(),
    minor: integer(),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
    createdBy: integer().notNull(),
    updatedBy: integer().notNull()
  },
  (table) => {
    return [primaryKey({ columns: [table.path, table.revision] })]
  }
)

export const commentsTable = sqliteTable('comments', {
  id: integer().primaryKey({ autoIncrement: true }),
  path: text().notNull(),
  body: text().notNull(),
  replyTo: integer(),
  userId: integer().notNull(),
  createdAt: text().notNull(),
  updatedAt: text().notNull()
})
