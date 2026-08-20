import { sanitizeHastTree } from './markdown-security'

export default function rehypeSecurity() {
  return sanitizeHastTree
}
