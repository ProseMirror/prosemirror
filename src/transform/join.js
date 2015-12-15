import {Pos, Fragment} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap, MovedRange, ReplacedRange} from "./map"

// !! **`join`**
//   : Join two block elements together. `from` and `to` must point at
//     the end of the first and start of the second element (so that
//     the intention is preserved even when the positions are mapped).

Step.define("join", {
  apply(doc, step) {
    let before = doc.path(step.from.path)
    let after = doc.path(step.to.path)
    if (step.from.offset < before.size || step.to.offset > 0 ||
        !before.type.canContainFragment(after.content)) return null
    let pFrom = step.from.path, pTo = step.to.path
    let last = pFrom.length - 1, offset = pFrom[last] + 1
    if (pFrom.length != pTo.length || pFrom.length == 0 || offset != pTo[last]) return null
    for (let i = 0; i < last; i++) if (pFrom[i] != pTo[i]) return null

    let targetPath = pFrom.slice(0, last)
    let target = doc.path(targetPath), oldSize = target.size
    if (target.type.locked) return null
    let joined = before.append(after.content)
    let copy = doc.replaceDeep(targetPath, target.splice(offset - 1, offset + 1, Fragment.from(joined)))

    let map = new PosMap([new MovedRange(step.to, after.size, step.from),
                          new MovedRange(new Pos(targetPath, offset + 1), oldSize - offset - 1, new Pos(targetPath, offset))],
                         [new ReplacedRange(step.from, step.to, step.from, step.from, step.to.shorten())])
    return new StepResult(copy, map)
  },
  invert(step, oldDoc) {
    return new Step("split", null, null, step.from, oldDoc.path(step.to.path).copy())
  }
})

// :: (Node, Pos) → bool
// Test whether the blocks before and after a given position can be
// joined.
export function joinableBlocks(doc, pos) {
  if (pos.offset == 0) return false
  let parent = doc.path(pos.path)
  if (parent.isTextblock || pos.offset == parent.size) return false
  let type = parent.child(pos.offset - 1).type
  return !type.isTextblock && type.contains && type == parent.child(pos.offset).type
}

// :: (Node, Pos, ?number) → ?Pos
// Find an ancestor of the given position that can be joined to the
// block before (or after if `dir` is positive). Returns the joinable
// point, if any.
export function joinPoint(doc, pos, dir = -1) {
  for (;;) {
    if (joinableBlocks(doc, pos)) return pos
    if (pos.depth == 0) return null
    pos = pos.shorten(null, dir < 0 ? 0 : 1)
  }
}

// :: (Pos) → Transform
// Join the blocks around the given position.
Transform.prototype.join = function(at) {
  let parent = this.doc.path(at.path)
  if (at.offset == 0 || at.offset == parent.size || parent.isTextblock) return this
  this.step("join", new Pos(at.path.concat(at.offset - 1), parent.child(at.offset - 1).size),
            new Pos(at.path.concat(at.offset), 0))
  return this
}
