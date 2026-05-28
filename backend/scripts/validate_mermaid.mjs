#!/usr/bin/env node

/**
 * Mermaid syntax validator (lightweight, Node.js compatible)
 *
 * Validates basic Mermaid flowchart syntax without requiring a browser DOM.
 * Mermaid v11+ depends on DOMPurify which doesn't work in pure Node.js,
 * so we use regex-based structural validation instead.
 *
 * Usage: echo "graph TD\n  A-->B" | node validate_mermaid.mjs
 * Exit 0 = valid, Exit 1 = invalid
 */

let input = ''

process.stdin.setEncoding('utf-8')
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  const code = input.trim()
  if (!code) {
    console.error('No mermaid code provided')
    process.exit(1)
  }

  const errors = validateMermaidFlowchart(code)
  if (errors.length === 0) {
    console.log('Valid mermaid syntax')
    process.exit(0)
  } else {
    console.error(`Invalid mermaid syntax: ${errors.join('; ')}`)
    process.exit(1)
  }
})

/**
 * Validate Mermaid flowchart syntax using structural rules.
 * Returns an array of error messages (empty = valid).
 */
function validateMermaidFlowchart(code) {
  const errors = []
  const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  if (lines.length === 0) {
    errors.push('Empty diagram')
    return errors
  }

  // Check declaration line: graph/flowchart + direction
  const declLine = lines[0]
  const declMatch = declLine.match(/^(graph|flowchart)\s+(TD|TB|BT|LR|RL)\s*$/i)
  if (!declMatch) {
    errors.push(`First line must be "graph TD" or "flowchart LR" etc., got: "${declLine}"`)
    return errors
  }

  // Parse remaining lines for node definitions and edges
  const nodeIds = new Set()
  let hasEdge = false

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    // Skip comments
    if (line.startsWith('%%')) continue

    // Skip style/class definitions
    if (line.match(/^(style|class|classDef|click|linkStyle)\s/i)) continue

    // Skip subgraph/end
    if (line.match(/^(subgraph|end)\b/i)) continue

    // Try to parse as edge(s): A --> B --> C
    // Node ID pattern: word chars, may have bracket label like A[Label] or A(Label) or A{Label} or A((Label))
    const nodePattern = /([A-Za-z_][\w]*)\s*(?:\[.*?\]|\(.*?\)|\{.*?\}|(?:\(\(.*?\)\)))?/g
    const arrowPattern = /\s*(?:-->|---->|-.->|--->|==>|====>|--\s.*?\s-->|--\s.*?\s-.->)\s*/

    // Check if line contains an arrow
    if (line.match(/-->|-.->|==>|---/)) {
      hasEdge = true

      // Extract node IDs from the line
      const parts = line.split(/-->|-.->|==>|---->|====>/)
      for (const part of parts) {
        const idMatch = part.trim().match(/^([A-Za-z_][\w]*)/)
        if (idMatch) {
          nodeIds.add(idMatch[1])
        }
      }
    } else {
      // Might be a standalone node definition: A[Label]
      const standaloneMatch = line.match(/^([A-Za-z_][\w]*)\s*[\[\(\{]/)
      if (standaloneMatch) {
        nodeIds.add(standaloneMatch[1])
      }
    }
  }

  if (!hasEdge) {
    errors.push('No edges (arrows) found in diagram')
  }

  if (nodeIds.size < 2) {
    errors.push(`Need at least 2 nodes, found ${nodeIds.size}`)
  }

  return errors
}
