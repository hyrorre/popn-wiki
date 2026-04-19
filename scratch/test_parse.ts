import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import * as fs from 'fs'

async function test() {
    const md = fs.readFileSync('scratch/test_body.md', 'utf-8')
    console.log('Body length:', md.length)
    console.log('Starting parse...')
    const start = Date.now()
    try {
        const ast = await parseMarkdown(md)
        console.log('Done in', Date.now() - start, 'ms')
        console.log('Nodes count:', ast.body.children.length)
    } catch (e) {
        console.error('Error parsing:', e)
    }
}

test()
