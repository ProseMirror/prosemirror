import {Slice} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap, ReplacedRange} from "./map"

// !! **`join`**
//   : Join two block elements together. `from` and `to` must point at
//     the end of the first and start of the second element (so that
//     the intention is preserved even when the positions are mapped).

Step.define("join", {
  apply(doc, step) {
    let from = doc.resolve(step.from), to = doc.resolve(step.to)
    if (from.parentOffset < from.parent.content.size || to.parentOffset > 0 || to.pos - from.pos != 2)
      return StepResult.fail("Join positions not around a split")
    return StepResult.fromReplace(doc, from.pos, to.pos, Slice.empty)
  },
  posMap(step) {
    return new PosMap([new ReplacedRange(step.from, 2, 0)])
  },
  invert(step) {
    return new Step("split", step.from, step.from) // FIXME restore types
  }
})

// :: (Node, number) → bool
// Test whether the blocks before and after a given position can be
// joined.
export function joinableBlocks(doc, pos) {
  let r = doc.resolve(pos), before = r.nodeBefore, after = r.nodeAfter
  return before && after && !before.isText && before.type.contains &&
    before.type.canContainContent(after.type)
}

// :: (Node, number, ?number) → ?Pos
// Find an ancestor of the given position that can be joined to the
// block before (or after if `dir` is positive). Returns the joinable
// point, if any.
export function joinPoint(doc, pos, dir = -1) {
  let r = doc.resolve(pos)
  for (let d = r.depth; d >= 0; d--) {
    if (joinableBlocks(doc, pos)) return pos
    if (pos.depth == 0) return null
    pos = dir < 0 ? r.before(d) : r.after(d)
  }
}

// :: (number) → Transform
// Join the blocks around the given position.
Transform.define("join", function(at) {
  return this.step("join", at - 1, at + 1)
})
