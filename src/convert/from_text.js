import {Span, Node} from "../model"
import {defineSource} from "./convert"

export function fromText(text) {
  let blocks = text.trim().split("\n\n")
  let doc = new Node("doc")
  for (let i = 0; i < blocks.length; i++) {
    let para = new Node("paragraph")
    let parts = blocks[i].split("\n")
    for (let j = 0; j < parts.length; j++) {
      if (j) para.push(new Span("hard_break"))
      para.push(Span.text(parts[j]))
    }
    doc.push(para)
  }
  return doc
}

defineSource("text", fromText)
