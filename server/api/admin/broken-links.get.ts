import { db } from '@nuxthub/db'
import { blob } from '@nuxthub/blob'
import { desc } from 'drizzle-orm'
import { visit } from 'unist-util-visit'
import { pagesTable } from '../../db/schema'

type LinkInfo = {
  sourcePath: string
  targetUrl: string
  text: string
  type: 'internal' | 'external' | 'image'
  error: string
  lineNumber?: number
}

type BrokenLinksResponse = {
  totalChecked: number
  brokenLinks: LinkInfo[]
  warnings: string[]
}

interface MDCNode {
  type: string
  tag?: string
  props?: Record<string, unknown>
  children?: MDCNode[]
  value?: string
}

type LatestPage = {
  path: string
  revision: number
  body: string
  bodyAst: string | null
}

const SKIPPED_PROTOCOLS = ['mailto:', 'tel:', 'javascript:', 'data:']
const IMAGE_ROUTE_PREFIX = '/api/image/'
const REDIRECTED_WIKI_PATHS = new Map([['start', '/']])
const REDIRECTED_IMAGE_ROUTE_PREFIXES = ['/score/start/', '/_media/score/start/']
const APP_ROUTE_PREFIXES = ['/api/', '/admin/', '/edit/']
const APP_ROUTES = new Set(['/signin', '/signup', '/profile', '/reply', '/forgot', '/reset', '/verify'])

const stripUrlFragmentAndQuery = (url: string) => url.split('#')[0]?.split('?')[0]?.trim() || ''

const isExternalUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')

const shouldSkipUrl = (url: string) => {
  const normalized = url.trim().toLowerCase()
  return (
    !normalized || normalized.startsWith('#') || SKIPPED_PROTOCOLS.some((protocol) => normalized.startsWith(protocol))
  )
}

const normalizePathSegments = (path: string) => {
  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

const normalizeRedirectedImagePath = (url: string) => {
  if (!url.endsWith('.png')) return null
  const prefix = REDIRECTED_IMAGE_ROUTE_PREFIXES.find((routePrefix) => url.startsWith(routePrefix))
  if (!prefix) return null

  const filename = url.slice(prefix.length).split('/').pop()?.trim()
  return filename || null
}

const normalizeRedirectedWikiPath = (path: string) => {
  const knownRedirect = REDIRECTED_WIKI_PATHS.get(path)
  if (knownRedirect) return knownRedirect

  const commentArchiveMatch = path.match(/^その他\/comment\/(.+)_\/(\d+)$/)
  if (commentArchiveMatch) {
    return `その他/comment/${commentArchiveMatch[1]}/${commentArchiveMatch[2]}`
  }

  const difficultyLevelMatch = path.match(/^難易度表\/lv\d+\/(.+)$/i)
  if (difficultyLevelMatch) {
    return `難易度表/${difficultyLevelMatch[1]}`
  }

  return path
}

const normalizeWikiPath = (rawUrl: string, sourcePath: string) => {
  const url = stripUrlFragmentAndQuery(rawUrl)
  if (shouldSkipUrl(url) || isExternalUrl(url)) return null
  if (normalizeRedirectedImagePath(url)) return null
  if (APP_ROUTES.has(url) || APP_ROUTE_PREFIXES.some((prefix) => url.startsWith(prefix))) return null

  const absolutePath = url.startsWith('/')
    ? url.replace(/^\/+/, '')
    : normalizePathSegments(`${sourcePath === '/' ? '' : sourcePath.split('/').slice(0, -1).join('/')}/${url}`)

  return normalizeRedirectedWikiPath(absolutePath || '/')
}

const normalizeImagePath = (rawUrl: string) => {
  const url = stripUrlFragmentAndQuery(rawUrl)
  if (shouldSkipUrl(url) || isExternalUrl(url)) return null

  const redirectedImagePath = normalizeRedirectedImagePath(url)
  const imagePath = redirectedImagePath
    ? redirectedImagePath
    : url.startsWith(IMAGE_ROUTE_PREFIX)
      ? url.slice(IMAGE_ROUTE_PREFIX.length)
      : url.replace(/^\/+/, '')
  return imagePath || null
}

const collectText = (node: MDCNode): string => {
  if (typeof node.value === 'string') return node.value
  if (!node.children?.length) return ''
  return node.children.map((child) => collectText(child)).join('')
}

const collectImagePaths = async () => {
  const imagePaths = new Set<string>()
  let cursor: string | undefined

  do {
    const result = await blob.list({ limit: 1000, cursor })
    for (const image of result.blobs) {
      imagePaths.add(String(image.pathname).replace(/^\/+/, ''))
    }
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)

  return imagePaths
}

const isEscaped = (body: string, index: number) => {
  let slashCount = 0
  for (let i = index - 1; i >= 0 && body[i] === '\\'; i--) {
    slashCount++
  }
  return slashCount % 2 === 1
}

export default defineEventHandler(async (event): Promise<BrokenLinksResponse> => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  console.log('[BrokenLinkChecker] Starting full scan...')

  const warnings: string[] = []
  let imagePaths = new Set<string>()
  let canCheckImages = false
  try {
    imagePaths = await collectImagePaths()
    canCheckImages = true
  } catch (error) {
    console.warn('[BrokenLinkChecker] Failed to list images:', error)
    warnings.push('画像一覧の取得に失敗したため、画像リンクのチェックをスキップしました。')
  }

  const allRows = await db
    .select({
      path: pagesTable.path,
      revision: pagesTable.revision,
      body: pagesTable.body,
      bodyAst: pagesTable.bodyAst
    })
    .from(pagesTable)
    .orderBy(desc(pagesTable.revision))
    .all()

  const latestPagesMap = new Map<string, LatestPage>()
  for (const row of allRows) {
    if (!latestPagesMap.has(row.path)) {
      latestPagesMap.set(row.path, row)
    }
  }

  const latestPages = [...latestPagesMap.values()].filter((page) => page.body !== '')
  const existingPaths = new Set(latestPages.map((page) => page.path))
  const brokenLinks: LinkInfo[] = []
  const seenBrokenLinks = new Set<string>()

  const addBrokenLink = (link: LinkInfo) => {
    const key = `${link.sourcePath}\0${link.type}\0${link.targetUrl}`
    if (seenBrokenLinks.has(key)) return
    seenBrokenLinks.add(key)
    brokenLinks.push(link)
  }

  console.log(`[BrokenLinkChecker] Found ${latestPages.length} active pages to check.`)

  for (const page of latestPages) {
    try {
      console.log(`[BrokenLinkChecker] Analyzing: ${page.path}`)
      let ast

      if (page.bodyAst) {
        try {
          ast = JSON.parse(page.bodyAst)
        } catch {
          console.warn(`[BrokenLinkChecker] Failed to parse bodyAst for ${page.path}`)
        }
      }

      const processUrl = (url: string, type: 'image' | 'link', text: string) => {
        if (shouldSkipUrl(url) || isExternalUrl(url)) return

        if (type === 'image') {
          if (!canCheckImages) return
          const imagePath = normalizeImagePath(url)
          if (imagePath && !imagePaths.has(imagePath)) {
            console.log(`[BrokenLinkChecker] Found broken image: ${url} on ${page.path}`)
            addBrokenLink({
              sourcePath: page.path,
              targetUrl: url,
              text: text.substring(0, 100),
              type: 'image',
              error: 'Image not found'
            })
          }
          return
        }

        const redirectedImagePath = normalizeRedirectedImagePath(stripUrlFragmentAndQuery(url))
        if (redirectedImagePath) {
          if (canCheckImages && !imagePaths.has(redirectedImagePath)) {
            console.log(`[BrokenLinkChecker] Found broken redirected image: ${url} on ${page.path}`)
            addBrokenLink({
              sourcePath: page.path,
              targetUrl: url,
              text: text.substring(0, 100),
              type: 'image',
              error: 'Image not found'
            })
          }
          return
        }

        const targetPath = normalizeWikiPath(url, page.path)
        if (targetPath && !existingPaths.has(targetPath)) {
          console.log(`[BrokenLinkChecker] Found broken link: ${url} on ${page.path}`)
          addBrokenLink({
            sourcePath: page.path,
            targetUrl: url,
            text: text.substring(0, 100),
            type: 'internal',
            error: 'Page not found'
          })
        }
      }

      if (ast) {
        visit(ast, (node: unknown) => {
          const n = node as MDCNode
          if (n.type !== 'element' && n.type !== 'link' && n.type !== 'image') return

          if (n.tag === 'img' || n.type === 'image') {
            const url = (n.props?.src as string) || n.value || ''
            const text = (n.props?.alt as string | undefined) || url
            processUrl(url, 'image', text)
          } else if (n.tag === 'a' || n.type === 'link') {
            const url = (n.props?.href as string) || n.value || ''
            processUrl(url, 'link', collectText(n) || url)
          }
        })
      } else if (page.body) {
        const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
        const linkRegex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g
        const htmlAnchorRegex = /<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gis
        const htmlImageRegex = /<img\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gis

        let match: RegExpExecArray | null
        while ((match = imgRegex.exec(page.body)) !== null) {
          if (isEscaped(page.body, match.index + 1)) continue
          processUrl(match[2] as string, 'image', match[1] || '')
        }
        while ((match = linkRegex.exec(page.body)) !== null) {
          if (isEscaped(page.body, match.index)) continue
          processUrl(match[2] as string, 'link', match[1] || '')
        }
        while ((match = htmlImageRegex.exec(page.body)) !== null) {
          processUrl(match[2] as string, 'image', match[2] || '')
        }
        while ((match = htmlAnchorRegex.exec(page.body)) !== null) {
          processUrl(match[2] as string, 'link', (match[3] || '').replace(/<[^>]+>/g, '').trim())
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
    totalChecked: latestPages.length,
    brokenLinks,
    warnings
  }
})
