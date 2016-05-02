import {Slice, Fragment} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap} from "./map"

// !! **`shift`**
//    : Change the node boundaries around a piece of content.
//
//      Can be used to delete and insert closing and opening
//      boundaries around a piece of content, in a single step. The
//      resulting tree must be well-shaped—you can't remove an opening
//      boundary on one side with removing one on the other side,
//      inserting a closing one, or overwriting an existing opening
//      boundary.
//
//      The parameter to this step is an object of the following shape:
//
//      ```
//      {
//        before: {overwrite: number, close: number, open: [{type: string, attrs: ?Object}]},
//        after: {overwrite: number, close: number, open: number}
//      }
//      ```
//
//      Except for `before.open`, all these are constrained by their
//      context, so you only have to provide a number. For
//      `before.open`, you have to provide actual node types and
//      attributes, so that the step knows what kind of boundaries to
//      create.
//
//      As an example, wrapping a paragraph in a blockquote could be
//      done with a `"shift"` step that whose `from` and `to` point
//      before and after the paragraph, with a `before.open` of
//      `{type: "blockquote"}` and an `after.close` of 1.
//
//      Lifting a paragraph _out_ of a blockquote would require a step
//      with an `overwrite` of 1 on both sides (overwriting the
//      opening and closing boundary of the blockquote.

function isFlatRange($from, $to) {
  if ($from.depth != $to.depth) return false
  for (let i = 0; i < $from.depth; i++)
    if ($from.index(i) != $to.index(i)) return false
  return $from.parentOffset <= $to.parentOffset
}

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
               close: before.overwrite - dBefore,
               open: bOpen},
      after: {overwrite: sAfter,
              close: dAfter,
              open: after.overwrite - dAfter}
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

  let before = {overwrite: 0, close: 0, open: []}
  let after = {overwrite: 0, close: 0, open: 0}

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

// :: (Node, number, ?number, NodeType, ?Object) → bool
// Determines whether the [sibling range](#Node.siblingRange) of the
// given positions can be wrapped in the given node type.
export function canWrap(doc, from, to, type, attrs) {
  return !!checkWrap(doc.resolve(from), doc.resolve(to == null ? from : to), type, attrs)
}

function checkWrap($from, $to, type, attrs) {
  let shared = rangeDepth($from, $to)
  if (shared == null) return null
  let parent = $from.node(shared)
  // FIXME make sure these allow each other as single child (or fill them)
  let around = parent.findWrappingAt($from.index(shared), type)
  let inside = type.findWrapping(parent.child($from.index(shared)).type, type.contentExpr.start(attrs || type.defaultAttrs))
  if (around && inside) return {shared, around, inside}
}

// :: (number, ?number, NodeType, ?Object) → Transform
// Wrap the [sibling range](#Node.siblingRange) of the given positions
// in a node of the given type, with the given attributes (if
// possible).
Transform.prototype.wrap = function(from, to = from, type, wrapAttrs) {
  let $from = this.doc.resolve(from), $to = this.doc.resolve(to)
  let check = checkWrap($from, $to, type, wrapAttrs)
  if (!check) throw new RangeError("Wrap not possible")
  let {shared, around, inside} = check

  let types = around.map(t => ({type: t.name})).concat({type: type.name})
      .concat(inside.map(t => ({type: t.name})))
  let start = $from.before(shared + 1)
  this.step("shift", start, $to.after(shared + 1), {
    before: {overwrite: 0, close: 0, open: types},
    after: {overwrite: 0, close: types.length, open: 0}
  })
  if (inside.length) {
    let splitPos = start + types.length, parent = $from.node(shared)
    for (let i = $from.index(shared), e = $to.index(shared) + 1, first = true; i < e; i++, first = false) {
      if (!first)
        this.split(splitPos, inside.length)
      splitPos += parent.child(i).nodeSize + (first ? 0 : 2 * inside.length)
    }
  }
  return this
}

// :: (number, ?number, NodeType, ?Object) → Transform
// Set the type of all textblocks (partly) between `from` and `to` to
// the given node type with the given attributes.
Transform.prototype.setBlockType = function(from, to = from, type, attrs) {
  if (!type.isTextblock) throw new RangeError("Type given to setBlockType should be a textblock")
  this.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock && !node.hasMarkup(type, attrs)) {
      // Ensure all markup that isn't allowed in the new node type is cleared
      let start = pos + 1, end = start + node.content.size
      this.clearMarkupFor(pos, type, attrs)
      this.step("shift", start, end, {
        before: {overwrite: 1, close: 0, open: [{type: type.name, attrs}]},
        after: {overwrite: 1, close: 1, open: 0}
      })
      return false
    }
  })
  return this
}

// :: (number, ?NodeType, ?Object) → Transform
// Change the type and attributes of the node after `pos`.
Transform.prototype.setNodeType = function(pos, type, attrs) {
  let node = this.doc.nodeAt(pos)
  if (!node) throw new RangeError("No node at given position")
  if (!type) type = node.type
  if (node.type.isLeaf)
    return this.replaceWith(pos, pos + node.nodeSize, type.create(attrs, null, node.marks))

  if (!type.checkContent(node.content, attrs))
    throw new RangeError("Invalid content for node type " + type.name)

  return this.step("shift", pos + 1, pos + 1 + node.content.size, {
    before: {overwrite: 1, close: 0, open: [{type: type.name, attrs}]},
    after: {overwrite: 1, close: 1, open: 0}
  })
}
