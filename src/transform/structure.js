import {Slice, Fragment} from "../model"

import {Transform} from "./transform"
import {ReplaceStep, ReplaceAroundStep} from "./replace_step"

// :: (Node, number, ?number) → bool
// Tells you whether the range in the given positions' shared
// ancestor, or any of _its_ ancestor nodes, can be lifted out of a
// parent.
export function canLift(doc, from, to) {
  return !!findLiftable(doc.resolve(from), doc.resolve(to == null ? from : to))
}

function rangeDepth($from, $to) {
  let shared = $from.sameDepth($to)
  if ($from.node(shared).isTextblock || $from.pos == $to.pos) --shared
  if (shared < 0 || $from.pos > $to.pos) return null
  return shared
}

function canCut(node, start, end) {
  return (start == 0 || node.canReplace(start, node.childCount)) &&
    (end == node.childCount || node.canReplace(0, start))
}

function findLiftable($from, $to) {
  let shared = rangeDepth($from, $to)
  if (!shared) return null
  let parent = $from.node(shared), content = parent.content.cutByIndex($from.index(shared), $to.indexAfter(shared))
  for (let depth = shared;; --depth) {
    let node = $from.node(depth), index = $from.index(depth)
    if (depth < shared && node.canReplace(index, index + 1, content))
      return {depth, shared, unwrap: false}
    if (depth == 0 || !canCut(node, index, index + 1)) break
  }

  if (parent.isBlock) {
    let joined = Fragment.empty
    content.forEach(node => joined = joined.append(node.content))
    for (let depth = shared;; --depth) {
      let node = $from.node(depth), index = $from.index(depth)
      if (depth < shared && node.canReplace(index, index + 1, joined))
        return {depth, shared, unwrap: true}
      if (depth == 0 || !canCut(node, index, index + 1)) break
    }
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

  if (unwrap) {
    let parent = $from.node(shared), pos = $to.after(shared + 1)
    for (let i = $to.indexAfter(shared); pos > from; i--) {
      let size = parent.child(i - 1).nodeSize
      this.lift(pos - size + 1, pos - 1, silent)
      pos -= size
    }
    return this
  }

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

  return this.step(new ReplaceAroundStep(start, end, gapStart, gapEnd,
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
  let parent = $from.node(shared), parentFrom = $from.index(shared), parentTo = $to.indexAfter(shared)
  let around = parent.contentMatchAt(parentFrom).findWrapping(type, attrs)
  if (!around) return null
  if (!parent.canReplaceWith(parentFrom, parentTo, around.length ? around[0].type : type,
                             around.length ? around[0].attrs : attrs)) return null
  let inner = parent.child(parentFrom)
  let inside = type.contentExpr.start(attrs || type.defaultAttrs).findWrapping(inner.type, inner.attrs)
  if (!inside) return null
  let lastInside = inside[inside.length - 1]
  let innerMatch = (lastInside ? lastInside.type : type).contentExpr.start(lastInside ? lastInside.attrs : attrs)
  for (let i = parentFrom; i < parentTo; i++)
    if (!(innerMatch = innerMatch.matchNode(parent.child(i)))) return null
  return {shared, around, inside}
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
  for (let i = inside.length - 1; i >= 0; i--) content = Fragment.from(inside[i].type.create(inside[i].attrs, content))
  content = Fragment.from(type.create(wrapAttrs, content))
  for (let i = around.length - 1; i >= 0; i--) content = Fragment.from(around[i].type.create(around[i].attrs, content))

  let start = $from.before(shared + 1), end = $to.after(shared + 1)
  this.step(new ReplaceAroundStep(start, end, start, end, new Slice(content, 0, 0), open, true))

  if (inside.length) {
    let splitPos = start + open, parent = $from.node(shared)
    for (let i = $from.index(shared), e = $to.index(shared) + 1, first = true; i < e; i++, first = false) {
      if (!first) this.split(splitPos, inside.length)
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
  let mapFrom = this.steps.length
  this.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock && !node.hasMarkup(type, attrs)) {
      // Ensure all markup that isn't allowed in the new node type is cleared
      this.clearMarkupFor(this.map(pos, 1, mapFrom), type, attrs)
      let startM = this.map(pos, 1, mapFrom), endM = this.map(pos + node.nodeSize, 1, mapFrom)
      this.step(new ReplaceAroundStep(startM, endM, startM + 1, endM - 1,
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

  if (!type.validContent(node.content, attrs))
    throw new RangeError("Invalid content for node type " + type.name)

  return this.step(new ReplaceAroundStep(pos, pos + node.nodeSize, pos + 1, pos + node.nodeSize - 1,
                                         new Slice(Fragment.from(type.create(attrs)), 0, 0), 1, true))
}

// :: (Node, number, ?NodeType, ?Object) → bool
// Check whether splitting at the given position is allowed.
export function canSplit(doc, pos, depth = 1, typeAfter, attrsAfter) {
  let $pos = doc.resolve(pos), base = $pos.depth - depth
  if (base < 0 ||
      !$pos.parent.canReplace($pos.index(), $pos.parent.childCount) ||
      !$pos.parent.canReplace(0, $pos.indexAfter()))
    return false
  for (let d = $pos.depth - 1; d > base; d--) {
    let node = $pos.node(d), index = $pos.index(d)
    if (!node.canReplace(0, index) ||
        !node.canReplaceWith(index, node.childCount, typeAfter || $pos.node(d + 1).type,
                             typeAfter ? attrsAfter : $pos.node(d + 1).attrs))
      return false
    typeAfter = null
  }
  let index = $pos.indexAfter(base)
  return $pos.node(base).canReplaceWith(index, index, typeAfter || $pos.node(base + 1).type,
                                        typeAfter ? attrsAfter : $pos.node(base + 1).attrs)
}

// :: (number, ?number, ?NodeType, ?Object) → Transform
// Split the node at the given position, and optionally, if `depth` is
// greater than one, any number of nodes above that. By default, the part
// split off will inherit the node type of the original node. This can
// be changed by passing `typeAfter` and `attrsAfter`.
Transform.prototype.split = function(pos, depth = 1, typeAfter, attrsAfter) {
  let $pos = this.doc.resolve(pos), before = Fragment.empty, after = Fragment.empty
  for (let d = $pos.depth, e = $pos.depth - depth; d > e; d--) {
    before = Fragment.from($pos.node(d).copy(before))
    after = Fragment.from(typeAfter ? typeAfter.create(attrsAfter, after) : $pos.node(d).copy(after))
    typeAfter = null
  }
  return this.step(new ReplaceStep(pos, pos, new Slice(before.append(after), depth, depth, true)))
}

// :: (Node, number) → bool
// Test whether the blocks before and after a given position can be
// joined.
export function joinable(doc, pos) {
  let $pos = doc.resolve(pos), index = $pos.index()
  return canJoin($pos.nodeBefore, $pos.nodeAfter) &&
    $pos.parent.canReplace(index, index + 1)
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
