import {$node, $text} from "../model"
import {defineSource} from "./index"

export function fromText(text) {
  let blocks = text.trim().split("\n\n")
  let nodes = []
  for (let i = 0; i < blocks.length; i++) {
    let spans = []
    let parts = blocks[i].split("\n")
    for (let j = 0; j < parts.length; j++) {
      if (j) spans.push($node("hard_break"))
      spans.push($text(parts[j]))
    }
    nodes.push($node("paragraph", null, spans))
  }
  if (!nodes.length) nodes.push($node("paragraph"))
  return $node("doc", null, nodes)
}

defineSource("text", fromText)
