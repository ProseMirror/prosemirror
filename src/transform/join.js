import {Pos} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {PosMap, MovedRange, ReplacedRange} from "./map"

defineStep("join", {
  apply(doc, step) {
    let before = doc.path(step.from.path)
    let after = doc.path(step.to.path)
    if (step.from.offset < before.maxOffset || step.to.offset > 0 ||
        before.type.contains != after.type.contains) return null
    let pFrom = step.from.path, pTo = step.to.path
    let last = pFrom.length - 1, offset = pFrom[last] + 1
    if (pFrom.length != pTo.length || pFrom.length == 0 || offset != pTo[last]) return null
    for (let i = 0; i < last; i++) if (pFrom[i] != pTo[i]) return null

    let targetPath = pFrom.slice(0, last)
    let target = doc.path(targetPath), oldSize = target.content.length
    let joined = before.append(after.content)
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

export function joinPoint(doc, pos, dir = -1) {
  let joinDepth = -1
  for (let i = 0, parent = doc; i < pos.path.length; i++) {
    let index = pos.path[i]
    let type = parent.content[index].type
    if (!type.block &&
        (dir == -1 ? (index > 0 && parent.content[index - 1].type == type)
                   : (index < parent.content.length - 1 && parent.content[index + 1].type == type)))
      joinDepth = i
    parent = parent.content[index]
  }
  if (joinDepth > -1) return pos.shorten(joinDepth, dir == -1 ? 0 : 1)
}

Transform.prototype.join = function(at) {
  let parent = this.doc.path(at.path)
  if (at.offset == 0 || at.offset == parent.content.length || parent.type.block) return this
  this.step("join", new Pos(at.path.concat(at.offset - 1), parent.content[at.offset - 1].maxOffset),
            new Pos(at.path.concat(at.offset), 0))
  return this
}
