import {slice, inline, Node, Pos} from "../model"
import {Result, defineTransform, flatTransform} from "./transform"

function insertNode(doc, pos, node) {
  let copy = slice.around(doc, pos)
  let parent = copy.path(pos.path)
  let result = new Result(doc, copy, pos)
  result.chunk(pos, new Pos(pos.path, parent.size),
               new Pos(pos.path, pos.offset + node.size))

  let {offset, styles} = inline.splitInlineAt(parent, pos.offset)
  parent.content.splice(offset, 0, new Node.Inline(node.type, styles, node.text, node.attrs))
  if (node.type == Node.types.text) {
    inline.stitchTextNodes(parent, offset + 1)
    inline.stitchTextNodes(parent, offset)
  }

  return result
}

defineTransform("insertInline", function(doc, params) {
  let node = params.node || new Node.Inline(params.type, null, params.text, params.attrs)
  if (node.type != Node.types.text &&
      doc.path(params.pos.path).type == Node.types.code_block)
    return flatTransform(doc)

  return insertNode(doc, params.pos, node)
})

defineTransform("insertText", function(doc, params) {
  if (!params.text) return flatTransform(doc)
  return insertNode(doc, params.pos, Node.text(params.text))
})
