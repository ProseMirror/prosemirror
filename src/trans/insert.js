import {Pos, Node, inline} from "../model"

import {defineTransform, Result, Step} from "./transform"
import {PosMap, Range} from "./map"
import {copyTo} from "./tree"

defineTransform("insert", {
  apply(doc, data) {
    let pos = data.from, nodes = data.param
    let copy = copyTo(doc, pos.path)
    let target = copy.path(pos.path), oldSize = target.maxOffset
    let offset = pos.offset
    let block = target.type.block
    if (block) {
      if (target.type.plainText &&
          (nodes.length > 1 || nodes[0].type != Node.types.text || nodes[0].styles.length))
        return null
      let split = inline.splitInlineAt(target, pos.offset)
      offset = split.offset
    }
    for (let i = nodes.length - 1; i >= 0; i--) target.content.splice(offset, 0, nodes[i])
    if (block) {
      inline.stitchTextNodes(target, offset + nodes.length)
      inline.stitchTextNodes(target, offset)
    }

    let sizeDiff = target.maxOffset - oldSize
    let map = new PosMap([new Range(pos, oldSize - pos.offset, new Pos(pos.path, pos.offset + sizeDiff), true)],
                         null,
                         [new Range(pos, sizeDiff)])
    return new Result(doc, copy, map)
  },
  invert(result, data) {
    return new Step("delete", data.from, result.map.map(data.from))
  }
})

export function insert(pos, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  return [new Step("insert", pos, null, nodes)]
}

export function insertInline(doc, pos, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  let styles = inline.inlineStylesAt(doc, pos)
  let nodes = nodes.map(n => new Node.Inline(n.type, styles, n.text, n.attrs))
  return [new Step("insert", pos, null, nodes)]
}

export function insertText(doc, pos, text) {
  return insertInline(doc, pos, Node.text(text))
}
