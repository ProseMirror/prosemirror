import {Block, Textblock, Inline, HardBreak, Text} from "../model"

import {defineTarget} from "./register"

function serializeFragment(fragment) {
  let accum = ""
  fragment.forEach(child => accum += child.type.serializeText(child))
  return accum
}

Block.prototype.serializeText = node => serializeFragment(node.content)

Textblock.prototype.serializeText = node => {
  let text = Block.prototype.serializeText(node)
  return text && text + "\n\n"
}

Inline.prototype.serializeText = () => ""

HardBreak.prototype.serializeText = () => "\n"

Text.prototype.serializeText = node => node.text

// :: (union<Node, Fragment>) → string
// Serialize content as a plain text string.
export function toText(content) {
  return serializeFragment(content).trim()
}

defineTarget("text", toText)
