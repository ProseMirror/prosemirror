import {Slice, Fragment} from "../model"

import {Transform} from "./transform"
import {ReplaceStep, ReplaceAroundStep} from "./replace_step"

function canCut(node, start, end) {
  return (start == 0 || node.canReplace(start, node.childCount)) &&
    (end == node.childCount || node.canReplace(0, start))
}

// :: (NodeRange) → ?number
// Try to find a target depth to which the content in the given range
// can be lifted.
export function liftTarget(range) {
  let parent = range.parent
  let content = parent.content.cutByIndex(range.startIndex, range.endIndex)
  for (let depth = range.depth;; --depth) {
    let node = range.from.node(depth), index = range.from.index(depth), endIndex = range.to.indexAfter(depth)
    if (depth < range.depth && node.canReplace(index, endIndex, content))
      return depth
    if (depth == 0 || !canCut(node, index, endIndex)) break
  }
}

// :: (NodeRange, number) → Transform
// Split the content in the given range off from its parent, if there
// is subling content before or after it, and move it up the tree to
// the depth specified by `target`. You'll probably want to use
// `liftTarget` to compute `target`, in order to be sure the lift is
// valid.
Transform.prototype.lift = function(range, target) {
  let {from: $from, to: $to, depth} = range

  let gapStart = $from.before(depth + 1), gapEnd = $to.after(depth + 1)
  let start = gapStart, end = gapEnd

  let before = Fragment.empty, openLeft = 0
  for (let d = depth, splitting = false; d > target; d--)
    if (splitting || $from.index(d) > 0) {
      splitting = true
      before = Fragment.from($from.node(d).copy(before))
      openLeft++
    } else {
      start--
    }
  let after = Fragment.empty, openRight = 0
  for (let d = depth, splitting = false; d > target; d--)
    if (splitting || $to.after(d + 1) < $to.end(d)) {
      splitting = true
      after = Fragment.from($to.node(d).copy(after))
      openRight++
    } else {
      end++
    }

  return this.step(new ReplaceAroundStep(start, end, gapStart, gapEnd,
                                         new Slice(before.append(after), openLeft, openRight),
                                         before.size - openLeft, true))
}

// :: (NodeRange, NodeType, ?Object) → ?[{type: NodeType, attrs: ?Object}]
// Try to find a valid way to wrap the content in the given range in a
// node of the given type. May introduce extra nodes around and inside
// the wrapper node, if necessary.
export function findWrapping(range, nodeType, attrs) {
  let parent = range.parent, parentFrom = range.startIndex, parentTo = range.endIndex
  let around = parent.contentMatchAt(parentFrom).findWrapping(nodeType, attrs)
  if (!around) return null
  let wrappers = around.concat({type: nodeType, attrs}), wrapLen = wrappers.length
  if (!parent.canReplaceWith(parentFrom, parentTo, wrappers[0].type, wrappers[0].attrs))
    return null
  let inner = parent.child(parentFrom)
  let inside = nodeType.contentExpr.start(attrs).findWrapping(inner.type, inner.attrs)
  if (!inside) return null
  wrappers = wrappers.concat(inside)
  let last = wrappers[wrappers.length - 1]
  let innerMatch = last.type.contentExpr.start(last.attrs)
  for (let i = parentFrom; i < parentTo; i++)
    innerMatch = innerMatch && innerMatch.matchNode(parent.child(i))
  if (!innerMatch || !innerMatch.validEnd()) return null
  wrappers.splitFrom = wrapLen
  return wrappers
}

// :: (NodeRange, [{type: NodeType, attrs: ?Object}]) → Transform
// Wrap the given [range](#NodeRange) in the given set of wrappers.
// The wrappers are assumed to be valid in this position, and should
// probably be computed with `findWrapping`.
Transform.prototype.wrap = function(range, wrappers) {
  let content = Fragment.empty
  for (let i = wrappers.length - 1; i >= 0; i--)
    content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content))

  let start = range.start, end = range.end
  this.step(new ReplaceAroundStep(start, end, start, end, new Slice(content, 0, 0), wrappers.length, true))

  let splitDepth = wrappers.length - wrappers.splitFrom
  if (splitDepth) {
    let splitPos = start + wrappers.length, parent = range.parent
    for (let i = range.startIndex, e = range.endIndex, first = true; i < e; i++, first = false) {
      if (!first) this.split(splitPos, splitDepth)
      splitPos += parent.child(i).nodeSize + (first ? 0 : 2 * splitDepth)
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

// :: (Node, number, NodeType, ?Object) → ?number
// Try to find a point where a node of the given type can be inserted
// near `pos`, by searching up the node hierarchy when `pos` itself
// isn't a valid place but is at the start or end of a node. Return
// null if no position was found.
export function insertPoint(doc, pos, nodeType, attrs) {
  let $pos = doc.resolve(pos)
  if ($pos.parent.canReplaceWith($pos.index(), $pos.index(), nodeType, attrs)) return pos

  if ($pos.parentOffset == 0)
    for (let d = $pos.depth - 1; d >= 0; d--) {
      let index = $pos.index(d)
      if ($pos.node(d).canReplaceWith(index, index, nodeType, attrs)) return $pos.before(d + 1)
      if (index > 0) return null
    }
  if ($pos.parentOffset == $pos.parent.content.size)
    for (let d = $pos.depth - 1; d >= 0; d--) {
      let index = $pos.indexAfter(d)
      if ($pos.node(d).canReplaceWith(index, index, nodeType, attrs)) return $pos.after(d + 1)
      if (index < $pos.node(d).childCount) return null
    }
}
