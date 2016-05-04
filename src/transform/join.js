import {Slice} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {SplitStep} from "./split"
import {PosMap} from "./map"

// ;; Step to join two block elements together.
export class JoinStep extends Step {
  // :: (number)
  // `pos` must point at the point between the two nodes to be joined.
  constructor(pos) {
    super()
    this.pos = pos
  }

  apply(doc) {
    if (!joinable(doc, this.pos))
      return StepResult.fail("Join position not between nodes")
    return StepResult.fromReplace(doc, this.pos - 1, this.pos + 1, Slice.empty)
  }

  posMap() {
    return new PosMap([this.pos - 1, 2, 0])
  }

  invert(doc) {
    let after = doc.nodeAt(this.pos)
    return new SplitStep(this.pos - 1, after.type.name, after.attrs)
  }

  map(mapping) {
    let from = mapping.mapResult(this.pos - 1, 1)
    let to = mapping.mapResult(this.pos + 1, -1)
    if (from.deleted && to.deleted || from.pos + 2 != to.pos) return null
    return new JoinStep(from.pos + 1)
  }

  static fromJSON(_schema, json) {
    return new JoinStep(json.pos)
  }
}

Step.register("join", JoinStep)

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
  for (let i = 0; i < depth; i++) {
    let $pos = this.doc.resolve(pos)
    if ($pos.parentOffset == 0 || $pos.parentOffset == $pos.parent.content.size ||
        !$pos.nodeAfter.type.compatibleContent($pos.nodeBefore.type)) {
      if (!silent) throw new RangeError("Nothing to join at " + pos)
      break
    }
    this.step(new JoinStep(pos))
    pos--
  }
  return this
}
