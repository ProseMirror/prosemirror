import {slice, inline, Node, Pos} from "../model"
import {Collapsed, Result, defineTransform, flatTransform} from "./transform"

function insertNode(doc, pos, node) {
  let copy = slice.around(doc, pos.path)
  let parent = copy.path(pos.path)
  let result = new Result(doc, copy)
  let inserted = result.inserted = new Collapsed(pos, new Pos(pos.path, pos.offset + node.size), pos)
  inserted.chunk(pos, node.size)
  result.chunk(pos, parent.size - pos.offset,
               new Pos(pos.path, pos.offset + node.size))

  let {offset, styles} = inline.splitInlineAt(parent, pos.offset)
  parent.content.splice(offset, 0, new Node.Inline(node.type, styles, node.text, node.attrs))
  if (node.type == Node.types.text) {
    inline.stitchTextNodes(parent, offset + 1)
    inline.stitchTextNodes(parent, offset)
  }

  return result
}

defineTransform("insertInline", {
  apply(doc, params) {
    let node = params.node || new Node.Inline(params.type, null, params.text, params.attrs)
    if (node.type != Node.types.text &&
        doc.path(params.pos.path).type == Node.types.code_block)
      return flatTransform(doc)

    return insertNode(doc, params.pos, node)
  },
  invert(result, params) {
    let len = params.text == null ? 1 : params.text.length
    return {name: "replace", pos: params.pos, end: new Pos(params.pos.path, params.pos.offset + len)}
  }
})

defineTransform("insertText", {
  apply(doc, params) {
    if (!params.text) return flatTransform(doc)
    return insertNode(doc, params.pos, Node.text(params.text))
  },
  invert(_result, params) {
    return {name: "replace", pos: params.pos, end: new Pos(params.pos.path, params.pos.offset + params.text.length)}
  }
})
