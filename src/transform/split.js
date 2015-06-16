import {Pos, Node, inline} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {copyTo} from "./tree"
import {PosMap, MovedRange, ReplacedRange} from "./map"

defineStep("split", {
  apply(doc, step) {
    let pos = step.pos
    if (pos.depth == 0) return null
    let copy = copyTo(doc, pos.path)
    let last = pos.depth - 1, parentPath = pos.path.slice(0, last)
    let offset = pos.path[last], parent = copy.path(parentPath)
    let target = parent.content[offset], targetSize = target.maxOffset
    let splitAt = pos.offset
    if (target.type.block)
      splitAt = inline.splitInlineAt(target, pos.offset).offset
    let after = (step.param || target).copy(target.content.slice(splitAt))
    target.content.length = splitAt
    parent.content.splice(offset + 1, 0, after)

    let dest = new Pos(parentPath.concat(offset + 1), 0)
    let map = new PosMap([new MovedRange(pos, targetSize - pos.offset, dest),
                          new MovedRange(new Pos(parentPath, offset + 1), parent.content.length - 2 - offset,
                                         new Pos(parentPath, offset + 2))],
                         [new ReplacedRange(pos, pos, pos, dest, pos, pos.shorten(null, 1))])
    return new TransformResult(copy, map)
  },
  invert(step, _oldDoc, map) {
    return new Step("join", step.pos, map.map(step.pos).pos)
  },
  paramToJSON(param) {
    return param && param.toJSON()
  },
  paramFromJSON(json) {
    return json && Node.fromJSON(json)
  }
})

Transform.prototype.split = function(pos, depth = 1, nodeAfter = null) {
  if (depth == 0) return this
  for (let i = 0;; i++) {
    this.step("split", null, null, pos, nodeAfter)
    if (i == depth - 1) return this
    nodeAfter = null
    pos = pos.shorten(null, 1)
  }
}
