import {Pos, Node, inline} from "../model"

import {defineTransform, Result, Step} from "./transform"
import {PosMap, Chunk} from "./map"
import {copyTo} from "./tree"

function applyInsert(doc, pos, nodes, keepStyle) {
  let copy = copyTo(doc, pos.path)
  let target = copy.path(pos.path)
  let offset = pos.offset
  let isInline = target.type.contains == "inline"
  if (isInline) {
    let split = inline.splitInlineAt(target, pos.offset)
    offset = split.offset
    if (keepStyle) nodes = nodes.map(n => new Node.Inline(n.type, split.styles, n.text, n.attrs))
  }
  for (let i = nodes.length - 1; i >= 0; i--) target.content.splice(offset, 0, nodes[i])
  if (isInline) {
    inline.stitchTextNodes(target, offset + nodes.length)
    inline.stitchTextNodes(target, offset)
  }
  return new Result(doc, copy, new PosMap(null, null, [new Chunk(pos, target.length)]))
}

defineTransform("insert", {
  apply(doc, data) { return applyInsert(doc, data.from, data.param, false) }
})

defineTransform("insertInline", {
  apply(doc, data) { return applyInsert(doc, data.from, data.param, true) }
})

export function insert(pos, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  return [new Step("insert", pos, null, nodes)]
}

export function insertInline(pos, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  return [new Step("insertInline", pos, null, nodes)]
}

export function insertText(pos, text) {
  return insertInline(pos, Node.text(text))
}
