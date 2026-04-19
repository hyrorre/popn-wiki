import { pagesTable } from '../../db/schema'
import { db } from '@nuxthub/db'
import { visit } from 'unist-util-visit'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { eq, desc, not, and } from 'drizzle-orm'

type LinkInfo = {
  sourcePath: string
  targetUrl: string
  text: string
  type: 'internal' | 'external' | 'image'
  error: string
  lineNumber?: number
}

interface MDCNode {
  type: string
  tag?: string
  props?: Record<string, unknown>
  children?: MDCNode[]
  value?: string
}

export default defineEventHandler(async (_) => {
  console.log('[BrokenLinkChecker] Starting full scan...')
  // 1. 全ページの情報を取得（最新リビジョンのみ）
  // メモリ節約のため、一旦パスとリビジョンのみ取得し、bodyは必要な場合のみ取得する
  const allRows = await db
    .select({
      path: pagesTable.path,
      revision: pagesTable.revision,
      bodyAst: pagesTable.bodyAst
    })
    .from(pagesTable)
    .where(not(eq(pagesTable.body, ''))) // 削除済みページを除外
    .orderBy(desc(pagesTable.revision))
    .all()

  // 重複を排除して最新リビジョンのみを保持
  const latestPagesMap = new Map<string, { path: string; revision: number; bodyAst: string | null }>()
  for (const row of allRows) {
    if (!latestPagesMap.has(row.path)) {
      latestPagesMap.set(row.path, row)
    }
  }

  const existingPaths = new Set(latestPagesMap.keys())
  const brokenLinks: LinkInfo[] = []

  console.log(`[BrokenLinkChecker] Found ${latestPagesMap.size} unique pages to check.`)

  // 2. 各ページを解析
  for (const page of latestPagesMap.values()) {
    try {
      console.log(`[BrokenLinkChecker] Analyzing: ${page.path}`)
      let ast
      let bodyToParse = ''

      if (page.bodyAst) {
        try {
          ast = JSON.parse(page.bodyAst)
        } catch {
          console.warn(`[BrokenLinkChecker] Failed to parse bodyAst for ${page.path}`)
        }
      }

      if (!ast) {
        // bodyAst がない場合のみ body をDBから取得
        const row = await db
          .select({ body: pagesTable.body })
          .from(pagesTable)
          .where(and(eq(pagesTable.path, page.path), eq(pagesTable.revision, page.revision)))
          .get()
        
        if (row?.body) {
          bodyToParse = row.body
          try {
            ast = await parseMarkdown(row.body)
          } catch (e: any) {
            console.warn(`[BrokenLinkChecker] parseMarkdown failed for ${page.path} (likely URI malformed). Using regex fallback.`)
          }
        }
      }

      const processUrl = (url: string, type: 'internal' | 'external' | 'image' | 'link', text: string) => {
        if (!url) return
        const isExternal = url.startsWith('http://') || url.startsWith('https://')
        const isAnchor = url.startsWith('#')

        if (isAnchor) return // 同一ページ内のアンカーは一旦スキップ

        if (isExternal) {
          // 外部リンクチェック（今回は構造のみ抽出）
        } else {
          // 内部リンクチェック
          const targetPathBase = url.split('#')[0]
          let targetPath = targetPathBase ? targetPathBase.split('?')[0] : ''
          
          // 相対パスの正規化
          if (targetPath && !targetPath.startsWith('/')) {
              // 相対パスの処理（必要に応じて実装）
          }

          // "/" 自体は存在する（トップページ）
          if (targetPath === '') targetPath = '/'

          if (targetPath !== undefined && !existingPaths.has(targetPath) && targetPath !== '/') {
            console.log(`[BrokenLinkChecker] Found broken ${type}: ${url} on ${page.path}`)
            brokenLinks.push({
              sourcePath: page.path,
              targetUrl: url,
              text: text.substring(0, 100),
              type: type,
              error: type === 'image' ? 'Image not found' : 'Page not found'
            })
          }
        }
      }

      if (ast) {
        // ASTを走査してリンクと画像を抽出
        visit(ast, (node: unknown) => {
          const n = node as MDCNode
          if (n.type === 'element' || n.type === 'link' || n.type === 'image' || n.tag === 'a' || n.tag === 'img') {
            const type = (n.type === 'image' || n.tag === 'img') ? 'image' : 'link'
            const url = (n.props?.href as string) || (n.props?.src as string) || n.value || ''
            
            let text = ''
            if (n.children) {
              text = n.children.map((c) => c.value || '').join('') || url
            } else if (n.props?.alt) {
              text = n.props.alt as string
            } else {
              text = url
            }

            processUrl(url, type, text)
          }
        })
      } else if (bodyToParse) {
        // Regex fallback
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
        const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
        
        let match
        while ((match = linkRegex.exec(bodyToParse)) !== null) {
          processUrl(match[2] as string, 'internal', match[1] || '')
        }
        while ((match = imgRegex.exec(bodyToParse)) !== null) {
          processUrl(match[2] as string, 'image', match[1] || '')
        }
      } else {
        console.log(`[BrokenLinkChecker] No AST or body for: ${page.path}`)
      }

      console.log(`[BrokenLinkChecker] Finished: ${page.path}`)
    } catch (e) {
      console.error(`[BrokenLinkChecker] Fatal error analyzing ${page.path}:`, e)
    }
  }

  console.log(`[BrokenLinkChecker] Scan finished. Found ${brokenLinks.length} broken items.`)

  return {
    totalChecked: latestPagesMap.size,
    brokenLinks
  }
})
