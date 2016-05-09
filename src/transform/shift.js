import {Slice, Fragment} from "../model"

import {Transform} from "./transform"
import {ReplaceWrapStep} from "./replace"

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

  let gapStart = $from.before(shared + 1), gapEnd = $to.after(shared + 1)
  let start = gapStart, end = gapEnd

  let before = Fragment.empty, beforeDepth = 0
  for (let d = shared, splitting = false; d > depth; d--)
    if (splitting || $from.index(d) > 0) {
      splitting = true
      before = Fragment.from($from.node(d).copy(before))
      beforeDepth++
    } else {
      start--
    }
  let after = Fragment.empty, afterDepth = 0
  for (let d = shared, splitting = false; d > depth; d--)
    if (splitting || $to.after(d + 1) < $to.end(d)) {
      splitting = true
      after = Fragment.from($to.node(d).copy(after))
      afterDepth++
    } else {
      end++
    }

  if (unwrap) {
    let joinPos = gapStart, parent = $from.node(shared)
    for (let i = $from.index(shared), e = $to.index(shared) + 1, first = true; i < e; i++, first = false) {
      if (!first) {
        this.join(joinPos)
        end -= 2
        gapEnd -= 2
      }
      joinPos += parent.child(i).nodeSize - (first ? 0 : 2)
    }
    ++gapStart
    --gapEnd
  }

  return this.step(new ReplaceWrapStep(start, end, gapStart, gapEnd,
                                       new Slice(before.append(after), beforeDepth, afterDepth),
                                       before.size - beforeDepth, true))
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

  let content = Fragment.empty, open = inside.length + 1 + around.length
  for (let i = inside.length - 1; i >= 0; i--) content = Fragment.from(inside[i].create(null, content))
  content = Fragment.from(type.create(wrapAttrs, content))
  for (let i = around.length - 1; i >= 0; i--) content = Fragment.from(around[i].create(null, content))

  let start = $from.before(shared + 1), end = $to.after(shared + 1)
  this.step(new ReplaceWrapStep(start, end, start, end, new Slice(content, 0, 0), open, true))

  if (inside.length) {
    let splitPos = start + open, parent = $from.node(shared)
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
      this.clearMarkupFor(this.map(pos), type, attrs)
      let startM = this.map(pos), endM = this.map(pos + node.nodeSize)
      this.step(new ReplaceWrapStep(startM, endM, startM + 1, endM - 1,
                                    new Slice(Fragment.from(type.create(attrs)), 0, 0), 1, true))
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

  return this.step(new ReplaceWrapStep(pos, pos + node.nodeSize, pos + 1, pos + node.nodeSize - 1,
                                       new Slice(Fragment.from(type.create(attrs)), 0, 0), 1, true))
}
