import {Pos, inline} from "../model"

import {defineStep, Result, Step, Transform} from "./transform"
import {PosMap, MovedRange, CollapsedRange} from "./map"
import {copyTo, isFlatRange, rangesBetween} from "./tree"

defineStep("delete", {
  apply(doc, data) {
    let from = data.from, to = data.to
    if (!isFlatRange(from, to)) return null
    let copy = copyTo(doc, from.path)
    let target = copy.path(from.path), oldSize = target.maxOffset
    if (target.type.contains == "inline") {
      let start = inline.splitInlineAt(target, from.offset).offset
      let end = inline.splitInlineAt(target, to.offset).offset
      target.content.splice(start, end - start)
      inline.stitchTextNodes(target, start)
    } else {
      target.content.splice(from.offset, to.offset - from.offset)
    }
    let map = new PosMap([new MovedRange(to, oldSize - to.offset, from)],
                         [new CollapsedRange(from, to, from)])
    return new Result(doc, copy, map)
  },
  invert(result, data) {
    let from = data.from
    let parent = result.before.path(from.path)
    return new Step("insert", from, null, parent.slice(from.offset, data.to.offset))
  }
})

Transform.prototype.delete = function(from, to) {
  let steps = []
  rangesBetween(this.doc, from, to, (path, start, end) => {
    steps.unshift(new Step("delete", new Pos(path, start), new Pos(path, end)))
  })
  steps.forEach(s => this.step(s))
  return this
}
