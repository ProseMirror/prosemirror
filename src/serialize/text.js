import {Block, Textblock, Inline, HardBreak, Text} from "../model"
import {defineTarget} from "../convert"

Block.prototype.serializeToText = node => {
  let accum = ""
  for (let i = 0; i < node.length; i++) {
    let child = node.child(i)
    accum += child.type.serializeToText(child)
  }
  return accum
}

Textblock.prototype.serializeToText = node => {
  let text = Block.prototype.serializeToText(node)
  return text && text + "\n\n"
}

Inline.prototype.serializeToText = () => ""

HardBreak.prototype.serializeToText = () => "\n"

Text.prototype.serializeToText = node => node.text

export function toText(doc) {
  return doc.type.serializeToText(doc).trim()
}

defineTarget("text", toText)
