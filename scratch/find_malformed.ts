import * as fs from 'fs'

const md = fs.readFileSync('scratch/test_body.md', 'utf-8')
const linkRegex = /https?:\/\/[^\s]+|\]\([^)]+\)/g
let match
while ((match = linkRegex.exec(md)) !== null) {
  const url = match[0]
  try {
    decodeURIComponent(url)
  } catch (e) {
    console.log('Malformed URL found:', url)
  }
}
