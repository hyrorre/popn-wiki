import { rebuildPageSearchIndex } from '../utils/pageSearchIndex'

type RebuildPageSearchFtsPayload = {
  reset?: boolean
  limit?: number
  cursor?: string
}

export default defineTask({
  meta: {
    name: 'rebuild-page-search-fts',
    description: 'Rebuild the page full-text search index from latest visible pages'
  },
  async run({ payload }) {
    return {
      result: await rebuildPageSearchIndex(payload as RebuildPageSearchFtsPayload | undefined)
    }
  }
})
