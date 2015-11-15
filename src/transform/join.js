import {Pos} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {PosMap, MovedRange, ReplacedRange} from "./map"

defineStep("join", {
  apply(doc, step) {
    let before = doc.path(step.from.path)
    let after = doc.path(step.to.path)
    if (step.from.offset < before.maxOffset || step.to.offset > 0 ||
        !before.type.canContainChildren(after, true)) return null
    let pFrom = step.from.path, pTo = step.to.path
    let last = pFrom.length - 1, offset = pFrom[last] + 1
    if (pFrom.length != pTo.length || pFrom.length == 0 || offset != pTo[last]) return null
    for (let i = 0; i < last; i++) if (pFrom[i] != pTo[i]) return null

    let targetPath = pFrom.slice(0, last)
    let target = doc.path(targetPath), oldSize = target.length
    if (target.type.locked) return null
    let joined = before.append(after.children)
    let copy = doc.replaceDeep(targetPath, target.splice(offset - 1, offset + 1, [joined]))

    let map = new PosMap([new MovedRange(step.to, after.maxOffset, step.from),
                          new MovedRange(new Pos(targetPath, offset + 1), oldSize - offset - 1, new Pos(targetPath, offset))],
                         [new ReplacedRange(step.from, step.to, step.from, step.from, step.to.shorten())])
    return new TransformResult(copy, map)
  },
  invert(step, oldDoc) {
    return new Step("split", null, null, step.from, oldDoc.path(step.to.path).copy())
  }
})

export function joinableBlocks(doc, pos) {
  if (pos.offset == 0) return false
  let parent = doc.path(pos.path)
  if (parent.isTextblock || pos.offset == parent.length) return false
  let type = parent.child(pos.offset - 1).type
  return !type.isTextblock && type.contains && type == parent.child(pos.offset).type
}

export function joinPoint(doc, pos, dir = -1) {
  for (;;) {
    if (joinableBlocks(doc, pos)) return pos
    if (pos.depth == 0) return null
    pos = pos.shorten(null, dir < 0 ? 0 : 1)
  }
}

Transform.prototype.join = function(at) {
  let parent = this.doc.path(at.path)
  if (at.offset == 0 || at.offset == parent.length || parent.isTextblock) return this
  this.step("join", new Pos(at.path.concat(at.offset - 1), parent.child(at.offset - 1).maxOffset),
            new Pos(at.path.concat(at.offset), 0))
  return this
}
