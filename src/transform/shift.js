import {Slice, Fragment} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap} from "./map"

// !! **`shift`**
//    : FIXME

function isFlatRange($from, $to) {
  if ($from.depth != $to.depth) return false
  for (let i = 0; i < $from.depth; i++)
    if ($from.index(i) != $to.index(i)) return false
  return $from.parentOffset <= $to.parentOffset
}

// {before: {overwrite, open, close}, after: {overwrite, open, close}}

Step.define("shift", {
  apply(doc, step) {
    let $from = doc.resolve(step.from), $to = doc.resolve(step.to), $before
    if (!isFlatRange($from, $to)) return StepResult.fail("Not a flat range")
    let {before, after} = step.param

    if (traceBoundary($from, before.overwrite, -1) == null ||
        traceBoundary($to, after.overwrite, 1) == null)
      return StepResult.fail("Shift step trying to overwrite non-boundary content")

    let {content, openLeft, openRight} = doc.slice(step.from, step.to)

    for (let i = before.open.length - 1; i >= 0; i--) {
      if (openLeft) {
        --openLeft
      } else {
        let open = before.open[i], type = doc.type.schema.nodes[open.type]
        content = Fragment.from(type.create(open.attrs, content))
        ++openRight
      }
    }
    for (let i = after.close, d; i > 0; i--) {
      if (openRight) {
        --openRight
      } else {
        if (d == null) {
          $before = doc.resolve(step.from - before.overwrite)
          d = $before.depth - before.close
        }
        content = Fragment.from($before.node(d--).copy(content))
        ++openLeft
      }
    }

    if (before.close) {
      if (!$before) $before = doc.resolve(step.from - before.overwrite)
      let inserted = null
      for (let i = 0; i < before.close; i++)
        inserted = $before.node($before.depth - i).copy(Fragment.from(inserted))
      content = addToStartAtDepth(content, inserted, openLeft)
      openLeft += before.close
    }
    if (after.open) {
      let $after = doc.resolve(step.to + after.overwrite), inserted = null
      for (let i = 0; i < after.open; i++)
        inserted = $after.node($after.depth - i).copy(Fragment.from(inserted))
      content = addToEndAtDepth(content, inserted, openRight)
      openRight += after.open
    }

    return StepResult.fromReplace(doc, step.from - before.overwrite,
                                  step.to + after.overwrite,
                                  new Slice(content, openLeft, openRight))
  },
  posMap(step) {
    let {before, after} = step.param
    return new PosMap([step.from - before.overwrite, before.overwrite, before.close + before.open.length,
                       step.to, after.overwrite, after.open + after.close])
  },
  invert(step, oldDoc) {
    let {before, after} = step.param
    let sBefore = before.close + before.open.length, sAfter = after.open + after.close
    let $from = oldDoc.resolve(step.from), bOpen = []
    let dBefore = traceBoundary($from, before.overwrite, -1)
    let dAfter = traceBoundary(oldDoc.resolve(step.to), after.overwrite, 1)
    for (let i = $from.depth - dBefore + 1; i <= $from.depth; i++) {
      let node = $from.node(i)
      bOpen.push({type: node.type.name, attrs: node.attrs})
    }
    let from = step.from - before.overwrite + sBefore
    let to = step.to - before.overwrite + sBefore

    return new Step("shift", from, to, {
      before: {overwrite: sBefore,
               open: bOpen,
               close: before.overwrite - dBefore},
      after: {overwrite: sAfter,
              open: after.overwrite - dAfter,
              close: dAfter}
    })
  }
})

function addToStartAtDepth(frag, node, depth) {
  if (!depth) return frag.addToStart(node)
  let child = frag.firstChild
  return frag.replaceChild(0, child.copy(addToStartAtDepth(child.content, node, depth - 1)))
}

function addToEndAtDepth(frag, node, depth) {
  if (!depth) return frag.addToEnd(node)
  let child = frag.lastChild
  return frag.replaceChild(frag.childCount - 1, child.copy(addToEndAtDepth(child.content, node, depth - 1)))
}

function traceBoundary($pos, dist, dir) {
  let down = 0, depth = $pos.depth
  while (dist > 0 && depth > 0 &&
         $pos.index(depth) == (dir < 0 ? 0 : $pos.node(depth).childCount - (down ? 1 : 0))) {
    down++
    depth--
    dist--
  }
  if (dist > 0) {
    let next = $pos.node(depth).maybeChild($pos.index(depth) + (dir < 0 ? -1 : down ? 1 : 0))
    while (dist > 0) {
      if (!next || next.type.isLeaf) return null
      next = dir < 0 ? next.lastChild : next.firstChild
      dist--
    }
  }
  return down
}

// :: (Node, number, ?number) → bool
// Tells you whether the range in the given positions' shared
// ancestor, or any of _its_ ancestor nodes, can be lifted out of a
// parent.
export function canLift(doc, from, to) {
  return !!findLiftable(doc.resolve(from), doc.resolve(to == null ? from : to))
}

function rangeDepth(from, to) {
  let shared = from.sameDepth(to)
  if (from.node(shared).isTextblock) --shared
  if (shared && from.before(shared) >= to.after(shared)) return null
  return shared
}

function findLiftable(from, to) {
  let shared = rangeDepth(from, to)
  if (shared == null) return null
  let parent = from.node(shared)
  for (let depth = shared - 1; depth >= 0; --depth)
    if (parent.type.compatibleContent(from.node(depth).type))
      return {depth, shared, unwrap: false}

  if (parent.isBlock) for (let depth = shared - 1; depth >= 0; --depth) {
    let target = from.node(depth)
    for (let i = from.index(shared), e = Math.min(to.index(shared) + 1, parent.childCount); i < e; i++)
      if (!parent.child(i).type.compatibleContent(target.type)) continue
    return {depth, shared, unwrap: true}
  }
}

// :: (number, ?number, ?bool) → Transform
// Lift the nearest liftable ancestor of the [sibling
// range](#Node.siblingRange) of the given positions out of its parent
// (or do nothing if no such node exists). When `silent` is true, this
// won't raise an error when the lift is impossible.
Transform.prototype.lift = function(from, to = from, silent = false) {
  let $from = this.doc.resolve(from), $to = this.doc.resolve(to)
  let liftable = findLiftable($from, $to)
  if (!liftable) {
    if (!silent) throw new RangeError("No valid lift target")
    return this
  }

  let {depth, shared, unwrap} = liftable
  let start = $from.before(shared + 1), end = $to.after(shared + 1)

  let before = {overwrite: 0, open: [], close: 0}
  let after = {overwrite: 0, open: 0, close: 0}

  for (let d = shared, splitting = false; d > depth; d--)
    if (splitting || $from.index(d) > 0) {
      splitting = true
      before.close++
    } else {
      before.overwrite++
    }
  for (let d = shared, splitting = false; d > depth; d--)
    if (splitting || $to.after(d + 1) < $to.end(d)) {
      splitting = true
      after.open++
    } else {
      after.overwrite++
    }

  if (unwrap) {
    let joinPos = start, parent = $from.node(shared)
    for (let i = $from.index(shared), e = $to.index(shared) + 1, first = true; i < e; i++, first = false) {
      if (!first) {
        this.join(joinPos)
        end -= 2
      }
      joinPos += parent.child(i).nodeSize - (first ? 0 : 2)
    }
    ++start
    --end
    ++before.overwrite
    ++after.overwrite
  }

  return this.step("shift", start, end, {before, after})
}
