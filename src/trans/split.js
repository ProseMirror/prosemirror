import {Pos, Node, inline} from "../model"

import {defineTransform, Result, Step} from "./transform"
import {copyTo} from "./tree"
import {PosMap, Range} from "./map"

defineTransform("split", {
  apply(doc, data) {
    let pos = data.from
    if (pos.path.length == 0) return null
    let copy = copyTo(doc, pos.path)
    let last = pos.path.length - 1, parentPath = pos.path.slice(0, last)
    let offset = pos.path[last], parent = copy.path(parentPath)
    let target = parent.content[offset], targetSize = target.maxOffset
    let splitAt = pos.offset
    if (target.type.contains == "inline")
      splitAt = inline.splitInlineAt(target, pos.offset).offset
    let after = (data.param || target).copy(target.content.slice(splitAt))
    target.content.length = splitAt
    parent.content.splice(offset + 1, 0, after)
    
    let map = new PosMap([new Range(pos, targetSize - pos.offset, new Pos(parentPath.concat(offset + 1), 0), true),
                          new Range(new Pos(parentPath, offset + 1), parent.content.length - 2 - offset,
                                    new Pos(parentPath, offset + 2))])
    return new Result(doc, copy, map)
  },
  invert(result, data) {
    return new Step("join", data.from, result.map.map(data.from))
  }
})

export function split(pos, depth = 1, nodeAfter = null) {
  let steps = []
  if (depth == 0) return steps
  for (let i = 0;; i++) {
    steps.push(new Step("split", pos, null, nodeAfter))
    if (i == depth - 1) return steps
    nodeAfter = null
    pos = pos.shorten(null, 1)
  }
}
