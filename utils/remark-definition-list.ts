import type { Root, Paragraph, PhrasingContent, Text, Code, Parent, RootContent } from 'mdast'
import { unified } from 'unified'
import remarkParse from 'remark-parse'

const inlineParser = unified().use(remarkParse)

interface DefinitionListItem {
  type: string
  data: { hName: string }
  children: PhrasingContent[]
}

export default function remarkDefinitionList() {
  return (tree: Root) => {
    const newChildren: Parent['children'] = []
    let currentDl: Parent | null = null

    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i]
      if (!node) continue

      // Identify if this node starts or continues a DL
      let isDlStart = false
      let isDlContinuation = false
      let startMatch: RegExpMatchArray | null = null

      const targetNode = node
      let firstChildText: Text | null = null

      if (node.type === 'paragraph' && node.children && node.children.length > 0) {
        const firstChild = node.children[0]
        if (firstChild && firstChild.type === 'text') {
          firstChildText = firstChild as Text
          startMatch = firstChildText.value.match(/^[ \t]*([:;])[ \t]+/)
          if (startMatch) {
            if (startMatch[1] === ';') {
              isDlStart = true // even if currentDl exists, we can treat it as continuation if we want, but starting a new DL or merging is fine. Let's merge if contiguous.
              if (currentDl) {
                isDlContinuation = true
                isDlStart = false
              }
            } else if (startMatch[1] === ':') {
              if (currentDl) isDlContinuation = true
              else isDlStart = true // weird, but possible
            }
          }
        }
      } else if (node.type === 'code') {
         const codeValue = (node as Code).value
         startMatch = codeValue.match(/^[ \t]*([:;])[ \t]+/)
         if (startMatch) {
           if (startMatch[1] === ';') {
             if (currentDl) isDlContinuation = true
             else isDlStart = true
           } else if (startMatch[1] === ':') {
             if (currentDl) isDlContinuation = true
             else isDlStart = true
           }
         }
      }

      if (isDlStart || isDlContinuation) {
        const items: DefinitionListItem[] = []

        if (node.type === 'code') {
          const codeValue = (node as Code).value
          const regex = /(?:^|\n)[ \t]*([:;])[ \t]+/g
          let match
          let lastIndex = 0
          
          const parts: { type: string, content: string }[] = []
          
          while ((match = regex.exec(codeValue)) !== null) {
            if (parts.length > 0 && match.index > lastIndex) {
              parts[parts.length - 1]!.content = codeValue.substring(lastIndex, match.index)
            }
            parts.push({ type: match[1] === ';' ? 'dt' : 'dd', content: '' })
            lastIndex = match.index + match[0].length
          }
          if (parts.length > 0 && lastIndex < codeValue.length) {
            parts[parts.length - 1]!.content = codeValue.substring(lastIndex)
          }
          
          for (const part of parts) {
            const parsed = inlineParser.parse(part.content)
            const unwrappedChildren: PhrasingContent[] = []
            
            for (let k = 0; k < parsed.children.length; k++) {
              const child = parsed.children[k]
              if (child && child.type === 'paragraph') {
                unwrappedChildren.push(...(child.children as PhrasingContent[]))
                if (k < parsed.children.length - 1) {
                  unwrappedChildren.push({ type: 'break' } as unknown as PhrasingContent)
                }
              } else if (child) {
                unwrappedChildren.push(child as unknown as PhrasingContent)
              }
            }
            
            items.push({
               type: 'definitionListItem',
               data: { hName: part.type },
               children: unwrappedChildren
            })
          }
        } else {
          let currentType = startMatch![1] === ';' ? 'dt' : 'dd'
          let currentChildren: PhrasingContent[] = []

          const modifiedFirstValue = firstChildText!.value.substring(startMatch![0].length)

          const processText = (text: string) => {
            const regex = /((?:^|\n)[ \t]*[:;][ \t]+)/
            const parts = text.split(regex)

            if (parts[0]) {
              currentChildren.push({ type: 'text', value: parts[0] })
            }

            for (let j = 1; j < parts.length; j += 2) {
              const separator = parts[j]
              const content = parts[j + 1]

              if (separator === undefined) continue

              // Remove preceding break node injected by remark-breaks if it exists
              if (currentChildren.length > 0 && currentChildren[currentChildren.length - 1]?.type === 'break') {
                currentChildren.pop()
              }

              if (currentChildren.length > 0) {
                items.push({ type: 'definitionListItem', data: { hName: currentType }, children: currentChildren })
              } else {
                items.push({ type: 'definitionListItem', data: { hName: currentType }, children: [] })
              }

              currentType = separator.includes(';') ? 'dt' : 'dd'
              currentChildren = []

              if (content) {
                currentChildren.push({ type: 'text', value: content })
              }
            }
          }

          const pNode = targetNode as Paragraph
          pNode.children.forEach((child, j) => {
            if (child.type === 'text') {
              const textNode = child as Text
              if (j === 0) {
                processText(modifiedFirstValue)
              } else {
                processText(textNode.value)
              }
            } else {
              currentChildren.push(child)
            }
          })

          if (currentChildren.length > 0) {
            items.push({ type: 'definitionListItem', data: { hName: currentType }, children: currentChildren })
          } else if (items.length === 0 && modifiedFirstValue === '') {
            items.push({ type: 'definitionListItem', data: { hName: currentType }, children: [] })
          }
        }


        if (isDlStart) {
          currentDl = {
            type: 'definitionList',
            data: { hName: 'dl' },
            children: items as unknown as RootContent[],
            position: node.position
          } as unknown as Parent
          newChildren.push(currentDl as unknown as RootContent)
        } else if (isDlContinuation && currentDl) {
          currentDl.children.push(...(items as unknown as RootContent[]))
          if (currentDl.position && node.position) currentDl.position.end = node.position.end
        }
      } else {
        // Not a DL, so we push the node normally, and reset currentDl
        currentDl = null
        newChildren.push(node as unknown as RootContent)
      }
    }

    tree.children = newChildren
  }
}
