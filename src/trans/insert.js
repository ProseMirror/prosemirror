import {Pos, Node, inline} from "../model"

import {defineStep, Result, Step, Transform} from "./transform"
import {PosMap, MovedRange, CollapsedRange} from "./map"
import {copyTo} from "./tree"

defineStep("insert", {
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
    let map = new PosMap([new MovedRange(pos, oldSize - pos.offset, new Pos(pos.path, pos.offset + sizeDiff))],
                         null,
                         [new CollapsedRange(pos, pos.shift(sizeDiff), pos)])
    return new Result(doc, copy, map)
  },
  invert(result, data) {
    return new Step("delete", data.from, result.map.mapSimple(data.from))
  }
})

Transform.prototype.insert = function(pos, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  this.step("insert", pos, null, nodes)
  return this
}

Transform.prototype.insertInline = function(pos, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  let styles = inline.inlineStylesAt(this.doc, pos)
  let nodes = nodes.map(n => new Node.Inline(n.type, styles, n.text, n.attrs))
  this.step("insert", pos, null, nodes)
  return this
}

Transform.prototype.insertText = function(pos, text) {
  return this.insertInline(pos, Node.text(text))
}
