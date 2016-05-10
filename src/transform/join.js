import {Slice} from "../model"

import {ReplaceStep} from "./replace"
import {Transform} from "./transform"

// :: (Node, number) → bool
// Test whether the blocks before and after a given position can be
// joined.
export function joinable(doc, pos) {
  let $pos = doc.resolve(pos)
  return canJoin($pos.nodeBefore, $pos.nodeAfter)
}

function canJoin(a, b) {
  return a && b && !a.isText && a.canAppend(b)
}

// :: (Node, number, ?number) → ?number
// Find an ancestor of the given position that can be joined to the
// block before (or after if `dir` is positive). Returns the joinable
// point, if any.
export function joinPoint(doc, pos, dir = -1) {
  let $pos = doc.resolve(pos)
  for (let d = $pos.depth;; d--) {
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
    if (d == 0) break
    pos = dir < 0 ? $pos.before(d) : $pos.after(d)
  }
}

// :: (number, ?number, ?bool) → Transform
// Join the blocks around the given position. When `silent` is true,
// the method will return without raising an error if the position
// isn't a valid place to join.
Transform.prototype.join = function(pos, depth = 1, silent = false) {
  if (silent && (pos < depth || pos + depth > this.doc.content.size)) return this
  let step = new ReplaceStep(pos - depth, pos + depth, Slice.empty, true)
  if (silent) this.maybeStep(step)
  else this.step(step)
  return this
}
