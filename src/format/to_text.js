import {Block, Textblock, Inline, HardBreak, Text} from "../model"

import {defineTarget} from "./register"

Block.prototype.serializeText = node => {
  let accum = ""
  node.forEach(child => accum += child.type.serializeText(child))
  return accum
}

Textblock.prototype.serializeText = node => {
  let text = Block.prototype.serializeText(node)
  return text && text + "\n\n"
}

Inline.prototype.serializeText = () => ""

HardBreak.prototype.serializeText = () => "\n"

Text.prototype.serializeText = node => node.text

// :: (Node) → string
// Serialize a node as a plain text string.
export function toText(doc) {
  return doc.type.serializeText(doc).trim()
}

defineTarget("text", toText)
