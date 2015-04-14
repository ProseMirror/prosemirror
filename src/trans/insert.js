import {Pos, Node, inline} from "../model"

import {defineTransform, Result, Step} from "./transform"
import {PosMap, Range} from "./map"
import {copyTo} from "./tree"

function applyInsert(doc, pos, nodes, keepStyle) {
  let copy = copyTo(doc, pos.path)
  let target = copy.path(pos.path), oldSize = target.maxOffset
  let offset = pos.offset
  let isInline = target.type.contains == "inline"
  if (isInline) {
    if (target.type == Node.types.code_block &&
        (nodes.length > 1 || nodes[0].type != Node.types.text || nodes[0].styles.length))
      return null
    let split = inline.splitInlineAt(target, pos.offset)
    offset = split.offset
    if (keepStyle) nodes = nodes.map(n => new Node.Inline(n.type, split.styles, n.text, n.attrs))
  }
  for (let i = nodes.length - 1; i >= 0; i--) target.content.splice(offset, 0, nodes[i])
  if (isInline) {
    inline.stitchTextNodes(target, offset + nodes.length)
    inline.stitchTextNodes(target, offset)
  }

  let sizeDiff = target.maxOffset - oldSize
  let map = new PosMap([new Range(pos, oldSize - pos.offset, new Pos(pos.path, pos.offset + sizeDiff), true)],
                       null,
                       [new Range(pos, sizeDiff)])
  return new Result(doc, copy, map)
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
