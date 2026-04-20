import fs from 'fs'
import path from 'path'
import type { DokuWikiComment } from '../server/tasks/seed'

const DEFAULT_OUTPUT_PATH = '.local/d1-seed.sql'
const DEFAULT_CHUNK_BYTES = 60000
const MAX_D1_STATEMENT_BYTES = 100000
const MAX_D1_ROW_TEXT_BYTES = 2000000

type SeedModule = typeof import('../server/tasks/seed')
type Scalar = string | number | boolean | null
type Row = Record<string, Scalar>

interface CliOptions {
  output: string
  onlyPages: boolean
  chunkBytes: number
  skipBodyAst: boolean
  includeSchema: boolean
  limit?: number
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    output: DEFAULT_OUTPUT_PATH,
    onlyPages: false,
    chunkBytes: DEFAULT_CHUNK_BYTES,
    skipBodyAst: false,
    includeSchema: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--only-pages') {
      options.onlyPages = true
    } else if (arg === '--include-schema') {
      options.includeSchema = true
    } else if (arg === '--skip-body-ast') {
      options.skipBodyAst = true
    } else if (arg === '--skip-too-large') {
      console.warn('[Warn] --skip-too-large is now the default behavior and can be omitted.')
    } else if (arg === '--output' || arg === '-o') {
      const value = argv[++i]
      if (!value) throw new Error(`${arg} requires a path`)
      options.output = value
    } else if (arg === '--chunk-bytes') {
      const value = Number(argv[++i])
      if (!Number.isInteger(value) || value < 1000 || value > 80000) {
        throw new Error('--chunk-bytes must be an integer between 1000 and 80000')
      }
      options.chunkBytes = value
    } else if (arg === '--limit') {
      const value = Number(argv[++i])
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--limit must be a positive integer')
      }
      options.limit = value
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function sqlIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function sqlValue(value: Scalar): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  return sqlString(value)
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8')
}

class TooLargeTextError extends Error {}

function assertStatementFits(statement: string): void {
  const size = byteLength(statement)
  if (size > MAX_D1_STATEMENT_BYTES) {
    throw new Error(`Generated SQL statement exceeds D1 limit: ${size} bytes\n${statement.slice(0, 500)}`)
  }
}

function splitTextBySqlLiteralBytes(value: string, maxSqlLiteralBytes: number): string[] {
  if (value.length === 0) return []

  const chunks: string[] = []
  let chunk = ''
  let chunkBytes = 2

  for (const char of value) {
    const charBytes = byteLength(char === "'" ? "''" : char)
    if (chunk && chunkBytes + charBytes > maxSqlLiteralBytes) {
      chunks.push(chunk)
      chunk = char
      chunkBytes = 2 + charBytes
      if (chunkBytes > maxSqlLiteralBytes) {
        throw new Error(`A single character exceeds the configured SQL chunk size: ${chunkBytes} bytes`)
      }
      continue
    }
    chunk += char
    chunkBytes += charBytes
  }

  if (chunk) chunks.push(chunk)
  return chunks
}

function createInsertStatement(tableName: string, row: Row): string {
  const keys = Object.keys(row)
  const columns = keys.map(sqlIdentifier).join(', ')
  const values = keys.map((key) => sqlValue(row[key] ?? null)).join(', ')
  const statement = `INSERT INTO ${sqlIdentifier(tableName)} (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;`
  assertStatementFits(statement)
  return statement
}

function createUpdateStatement(tableName: string, setSql: string, whereSql: string): string {
  const statement = `UPDATE ${sqlIdentifier(tableName)} SET ${setSql} WHERE ${whereSql};`
  assertStatementFits(statement)
  return statement
}

function keyWhere(row: Row, keys: string[]): string {
  return keys.map((key) => `${sqlIdentifier(key)} = ${sqlValue(row[key] ?? null)}`).join(' AND ')
}

function addInsertWithChunkedText(
  statements: string[],
  tableName: string,
  row: Row,
  keyColumns: string[],
  chunkColumns: string[],
  chunkBytes: number
): void {
  const baseRow: Row = { ...row }
  const chunkValues = new Map<string, string>()

  for (const column of chunkColumns) {
    const value = row[column]
    if (typeof value !== 'string' || value.length === 0) continue

    const valueBytes = byteLength(value)
    if (valueBytes > MAX_D1_ROW_TEXT_BYTES) {
      throw new TooLargeTextError(
        `${tableName}.${column} for ${keyWhere(row, keyColumns)} exceeds D1 row text limit: ${valueBytes} bytes`
      )
    }

    chunkValues.set(column, value)
    baseRow[column] = ''
  }

  statements.push(createInsertStatement(tableName, baseRow))

  const whereSql = keyWhere(row, keyColumns)
  for (const [column, value] of chunkValues) {
    for (const chunk of splitTextBySqlLiteralBytes(value, chunkBytes)) {
      statements.push(
        createUpdateStatement(
          tableName,
          `${sqlIdentifier(column)} = ${sqlIdentifier(column)} || ${sqlString(chunk)}`,
          whereSql
        )
      )
    }
  }
}

async function loadSeedModule(): Promise<SeedModule> {
  // Nitro provides defineTask at runtime. The SQL generator imports the task file
  // only to reuse its DokuWiki conversion helpers, so a tiny shim is enough here.
  Object.assign(globalThis, {
    defineTask: (task: unknown) => task
  })
  return await import('../server/tasks/seed')
}

function withoutConsoleLog<T>(callback: () => T): T {
  const originalLog = console.log
  console.log = () => {}
  try {
    return callback()
  } finally {
    console.log = originalLog
  }
}

function readSchemaSql(): string {
  const migrationsDir = path.resolve(process.cwd(), 'server/db/migrations')
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  return migrationFiles
    .map((file) => {
      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf8').trim()
      return `-- Schema migration: ${file}\n${sql}`
    })
    .join('\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const seed = await loadSeedModule()
  const statements: string[] = [
    '-- Generated by bun run db:seed:sql',
    '-- Import with: bunx wrangler d1 execute <DATABASE_NAME> --remote --file=' + options.output
  ]

  if (options.includeSchema) {
    statements.push('-- Includes schema migrations. Use this only for an empty database.', readSchemaSql())
  }

  statements.push('PRAGMA defer_foreign_keys = true;')

  const pagesDir = path.resolve(process.cwd(), '.local/pages')
  if (!fs.existsSync(pagesDir)) {
    throw new Error(`Pages directory not found: ${pagesDir}`)
  }

  const defaultUserId = 0
  const titleMap = seed.buildTitleMap(pagesDir)
  const files = seed
    .getFilesRecursively(pagesDir)
    .filter((file) => file.endsWith('.txt'))
    .slice(0, options.limit)
  let allComments: { pagePath: string; comment: DokuWikiComment }[] = []
  const oldUserIdToNewId = new Map<string, number>()

  if (!options.onlyPages) {
    const metaDir = path.resolve(process.cwd(), '.local/meta')
    let commentUsers = new Map<string, { id: string; name: string }>()

    if (fs.existsSync(metaDir)) {
      const parsed = withoutConsoleLog(() => seed.collectAllComments(metaDir))
      allComments = parsed.comments
      commentUsers = parsed.users
    } else {
      console.warn('Meta directory not found:', metaDir)
    }

    const authUsers = seed.parseUsersAuth(path.resolve(process.cwd(), '.local/users.auth.php'))
    const allUniqueUsers = new Map<string, { id: string; name: string; email: string; password: string }>()

    for (const [id, data] of authUsers) {
      allUniqueUsers.set(id, data)
    }
    for (const [id, data] of commentUsers) {
      if (!allUniqueUsers.has(id)) {
        allUniqueUsers.set(id, { ...data, email: `${id}@migrated.local`, password: '!' })
      }
    }

    statements.push('DELETE FROM comments;', 'DELETE FROM users;')

    const userNow = new Date().toISOString()
    let nextUserId = 1
    for (const [oldId, user] of allUniqueUsers) {
      const id = nextUserId++
      oldUserIdToNewId.set(oldId, id)
      addInsertWithChunkedText(
        statements,
        'users',
        {
          id,
          name: user.name,
          email: user.email,
          password: user.password,
          created_at: userNow,
          updated_at: userNow,
          confirmed: 1
        },
        ['id'],
        [],
        options.chunkBytes
      )
    }
  }

  statements.push('DELETE FROM pages;')

  let pageCount = 0
  let bodyAstCount = 0
  let skippedTooLarge = 0
  for (const file of files) {
    pageCount++
    if (pageCount % 100 === 0 || pageCount === files.length) {
      console.log(`[Pages] ${pageCount}/${files.length}: ${file}`)
    }

    const relativePath = path
      .relative(pagesDir, file)
      .replace(/\.txt$/, '')
      .replace(/\\/g, '/')
    const bodyContent = fs.readFileSync(file, 'utf8')
    const markdown = seed.convertDokuwikiToMarkdown(bodyContent, titleMap)
    const now = new Date().toISOString()
    const pagePath = relativePath === 'start' ? '/' : seed.decodeLegacyPath(relativePath)
    const dbPath = pagePath.toLowerCase()
    const title =
      titleMap.get(dbPath) ||
      (relativePath === 'start' ? 'Home' : seed.decodeLegacyPath(relativePath.split('/').pop() || ''))
    const bodyAst = options.skipBodyAst ? null : await seed.createBodyAstForSeed(markdown, pagePath)
    if (bodyAst) bodyAstCount++

    try {
      addInsertWithChunkedText(
        statements,
        'pages',
        {
          path: pagePath,
          title,
          revision: 1,
          body: markdown,
          body_ast: bodyAst,
          message: null,
          minor: 0,
          created_at: now,
          updated_at: now,
          created_by: defaultUserId,
          updated_by: defaultUserId
        },
        ['path', 'revision'],
        ['body', 'body_ast'],
        options.chunkBytes
      )
    } catch (error) {
      if (error instanceof TooLargeTextError) {
        skippedTooLarge++
        console.warn(`[Warn] Skipped too-large page ${pagePath}: ${error.message}`)
        continue
      }
      throw error
    }
  }

  let insertedComments = 0
  if (!options.onlyPages) {
    statements.push('DELETE FROM comments;')
    const cidToNewId = new Map<string, number>()
    let nextCommentId = 1
    let commentProgress = 0

    for (const { pagePath, comment } of allComments.slice(0, options.limit)) {
      commentProgress++
      if (commentProgress % 100 === 0 || commentProgress === allComments.length) {
        console.log(`[Comments] ${commentProgress}/${allComments.length}: ${pagePath}`)
      }

      const newUserId = oldUserIdToNewId.get(comment.user.id)
      if (newUserId === undefined) {
        console.warn(`[Warn] Skipping comment ${comment.cid} because user ${comment.user.id} not found in map.`)
        continue
      }

      const id = nextCommentId++
      const replyToId = comment.parent ? (cidToNewId.get(comment.parent) ?? null) : null
      const body = seed.convertDokuwikiToMarkdown(comment.raw, titleMap)
      const createdAt = new Date(comment.date.created * 1000).toISOString()
      const updatedAt = comment.date.modified ? new Date(comment.date.modified * 1000).toISOString() : createdAt

      try {
        addInsertWithChunkedText(
          statements,
          'comments',
          {
            id,
            path: pagePath,
            body,
            reply_to: replyToId,
            user_id: newUserId,
            created_at: createdAt,
            updated_at: updatedAt,
            deleted_at: null
          },
          ['id'],
          ['body'],
          options.chunkBytes
        )
      } catch (error) {
        if (error instanceof TooLargeTextError) {
          skippedTooLarge++
          console.warn(`[Warn] Skipped too-large comment ${comment.cid}: ${error.message}`)
          continue
        }
        throw error
      }

      cidToNewId.set(comment.cid, id)
      insertedComments++
    }
  }

  statements.push('PRAGMA defer_foreign_keys = false;')

  const outputPath = path.resolve(process.cwd(), options.output)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, statements.join('\n') + '\n')

  console.log(`Generated ${outputPath}`)
  console.log(`Pages: ${files.length}, page ASTs: ${bodyAstCount}, comments: ${insertedComments}`)
  if (skippedTooLarge > 0) console.log(`Skipped too-large records: ${skippedTooLarge}`)
  console.log(`Statements: ${statements.length}, size: ${byteLength(statements.join('\n'))} bytes`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
