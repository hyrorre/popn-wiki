import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core'

export const usersTable = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  email: text().notNull().unique(),
  password: text().notNull(),
  avatar: text(),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
  confirmed: integer().notNull().default(0)
})

export const pagesTable = sqliteTable(
  'pages',
  {
    path: text().notNull(),
    title: text().notNull().default(''),
    revision: integer().notNull(),
    body: text().notNull(),
    message: text(),
    minor: integer(),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
    createdBy: integer().notNull(),
    updatedBy: integer().notNull(),
    bodyAst: text()
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

export const tokensTable = sqliteTable('tokens', {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer().notNull(),
  token: text().notNull().unique(),
  type: text().notNull(), // 'verification', 'reset'
  expiresAt: integer().notNull() // timestamp
})
