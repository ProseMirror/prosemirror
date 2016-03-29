import {AssertionError} from "../util/error"
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
    let $from = doc.resolve(step.from), $to = doc.resolve(step.to)
    if ($from.parentOffset < $from.parent.content.size || $to.parentOffset > 0 || $to.pos - $from.pos != 2)
      return StepResult.fail("Join positions not around a split")
    return StepResult.fromReplace(doc, $from.pos, $to.pos, Slice.empty)
  },
  posMap(step) {
    return new PosMap([new ReplacedRange(step.from, 2, 0)])
  },
  invert(step, doc) {
    let $before = doc.resolve(step.from), d1 = $before.depth - 1
    let parentAfter = $before.node(d1).child($before.index(d1) + 1)
    let param = null
    if (!$before.parent.sameMarkup(parentAfter))
      param = {type: parentAfter.type, attrs: parentAfter.attrs}
    return new Step("split", step.from, step.from, param)
  }
})

// :: (Node, number) → bool
// Test whether the blocks before and after a given position can be
// joined.
export function joinable(doc, pos) {
  let $pos = doc.resolve(pos)
  return canJoin($pos.nodeBefore, $pos.nodeAfter)
}

function canJoin(a, b) {
  return a && b && !a.isText && a.type.contains && a.type.canContainContent(b.type)
}

// :: (Node, number, ?number) → ?number
// Find an ancestor of the given position that can be joined to the
// block before (or after if `dir` is positive). Returns the joinable
// point, if any.
export function joinPoint(doc, pos, dir = -1) {
  let $pos = doc.resolve(pos)
  for (let d = $pos.depth; d >= 0; d--) {
    let before, after
    if (d == $pos.depth) {
      before = $pos.nodeBefore
      after = $pos.nodeAfter
    } else if (dir > 0) {
      before = $pos.node(d + 1)
      after = $pos.node(d).maybeChild($pos.index(d) + 1)
    } else {
      before = $pos.node(d).maybeChild($pos.index(d) - 1)
      after = $pos.node(d + 1)
    }
    if (before && !before.isTextblock && canJoin(before, after)) return pos
    pos = dir < 0 ? $pos.before(d) : $pos.after(d)
  }
}

// :: (number, ?number, ?bool) → Transform
// Join the blocks around the given position. When `silent` is true,
// the method will return without raising an error if the position
// isn't a valid place to join.
Transform.prototype.join = function(pos, depth = 1, silent = false) {
  for (let i = 0; i < depth; i++) {
    let $pos = this.doc.resolve(pos)
    if ($pos.parentOffset == 0 || $pos.parentOffset == $pos.parent.content.size ||
        !$pos.nodeBefore.type.canContainContent($pos.nodeAfter.type)) {
      if (!silent) throw new AssertionError("Nothing to join at " + pos)
      break
    }
    this.step("join", pos - 1, pos + 1)
    pos--
  }
  return this
}
