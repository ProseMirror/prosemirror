import {Span, Node} from "../model"
import {defineSource} from "./index"

export function fromText(text) {
  let blocks = text.trim().split("\n\n")
  let nodes = []
  for (let i = 0; i < blocks.length; i++) {
    let spans = []
    let parts = blocks[i].split("\n")
    for (let j = 0; j < parts.length; j++) {
      if (j) spans.push(new Span("hard_break"))
      spans.push(Span.text(parts[j]))
    }
    doc.push(new Node("paragraph", null, spans))
  }
  if (!nodes.length) nodes.push(new Node("paragraph"))
  return new Node("doc", null, nodes)
}

defineSource("text", fromText)
