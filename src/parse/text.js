import {defineSource} from "./index"

// FIXME is it meaningful to try and attach text-parsing information
// to node types?

export function fromText(schema, text) {
  let blocks = text.trim().split(/\n{2,}/)
  let nodes = []
  for (let i = 0; i < blocks.length; i++) {
    let spans = []
    let parts = blocks[i].split("\n")
    for (let j = 0; j < parts.length; j++) {
      if (j) spans.push(schema.node("hard_break"))
      if (parts[j]) spans.push(schema.text(parts[j]))
    }
    nodes.push(schema.node("paragraph", null, spans))
  }
  if (!nodes.length) nodes.push(schema.node("paragraph"))
  return schema.node("doc", null, nodes)
}

defineSource("text", fromText)
