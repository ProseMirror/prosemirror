import {Pos, inline} from "../model"

import {defineTransform, Result, Step} from "./transform"
import {PosMap, Chunk} from "./map"
import {copyTo, isRange, rangesBetween} from "./tree"

defineTransform("delete", {
  apply(doc, data) {
    let from = data.from, to = data.to
    if (!isRange(from, to)) return null
    let copy = copyTo(doc, from.path)
    let target = copy.path(from.path)
    if (target.type.contains == "inline") {
      let start = inline.splitInlineAt(target, from.offset).offset
      let end = inline.splitInlineAt(target, to.offset).offset
      target.content.splice(start, end)
      inline.stitchTextNodes(target, start)
    } else {
      target.content.splice(from.offset, to.offset - from.offset)
    }
    return new Result(doc, copy, new PosMap(null, [new Chunk(from, to.offset - from.offset)]))
  }
})

export function del(doc, from, to) {
  let steps = []
  rangesBetween(doc, from, to, function(path, start, end) {
    steps.push(new Step("delete", new Pos(path, start), new Pos(path, end)))
  })
  return steps
}
