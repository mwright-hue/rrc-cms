export const extractPlainText = (value: any): string => {
  if (!value) return ''
  const acc: string[] = []
  const walk = (node: any) => {
    if (!node) return
    if (typeof node === 'string') {
      acc.push(node)
      return
    }
    if (Array.isArray(node)) {
      for (const n of node) walk(n)
      return
    }
    if (typeof node === 'object') {
      if (node.text) acc.push(String(node.text))
      // Lexical/Slate nodes usually have children
      if (node.children) walk(node.children)
      if (node.content) walk(node.content)
      // Payload richText sometimes stores arrays at .root.children
      if (node.root) walk(node.root)
    }
  }
  walk(value)
  return acc.join(' ').replace(/\s+/g, ' ').trim()
}

