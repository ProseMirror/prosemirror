import {Block, Textblock, Inline, HardBreak, Text} from "../model"
import {defineTarget} from "./index"

Block.prototype.serializeText = node => {
  let accum = ""
  for (let i = 0; i < node.length; i++) {
    let child = node.child(i)
    accum += child.type.serializeText(child)
  }
  return accum
}

Textblock.prototype.serializeText = node => {
  let text = Block.prototype.serializeText(node)
  return text && text + "\n\n"
}

Inline.prototype.serializeText = () => ""

HardBreak.prototype.serializeText = () => "\n"

Text.prototype.serializeText = node => node.text

export function toText(doc) {
  return doc.type.serializeText(doc).trim()
}

defineTarget("text", toText)
