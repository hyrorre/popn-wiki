import { rebuildPageSearchIndex } from '../utils/pageSearchIndex'

export default defineTask({
  meta: {
    name: 'search:rebuild-page-fts',
    description: 'Rebuild the page full-text search index from latest visible pages'
  },
  async run() {
    return {
      result: await rebuildPageSearchIndex()
    }
  }
})
