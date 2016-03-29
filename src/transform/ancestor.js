import {AssertionError} from "../util/error"
import {Slice, Fragment} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap, ReplacedRange} from "./map"

// !! **`ancestor`**
//    : Change the stack of nodes that wrap the part of the document
//      between `from` and `to`, which must point into the same parent
//      node.
//
//      The set of ancestors to replace is determined by the `depth`
//      property of the step's parameter. If this is greater than
//      zero, `from` and `to` must point at the start and end of a
//      stack of nodes, of that depth, since this step will not split
//      nodes.
//
//      The set of new ancestors to wrap with is determined by the
//      `types` and `attrs` properties of the parameter. The first
//      should be an array of `NodeType`s, and the second, optionally,
//      an array of attribute objects.

function isFlatRange($from, $to) {
  if ($from.depth != $to.depth) return false
  for (let i = 0; i < $from.depth; i++)
    if ($from.index(i) != $to.index(i)) return false
  return $from.parentOffset <= $to.parentOffset
}

Step.define("ancestor", {
  apply(doc, step) {
    let $from = doc.resolve(step.from), $to = doc.resolve(step.to)
    if (!isFlatRange($from, $to)) return StepResult.fail("Not a flat range")

    let {depth = 0, types = [], attrs = []} = step.param
    if (depth == 0 && types.length == 0) return StepResult.ok(doc)

    for (let i = 0, d = $from.depth; i < depth; i++, d--)
      if ($from.start(d) != $from.pos - i || $to.end(d) != $to.pos + i)
        return StepResult.fail("Parent at depth " + d + " not fully covered")

    let inner = $from.parent, slice
    if (types.length) {
      let lastWrapper = types[types.length - 1]
      let content = inner.content.cut($from.parentOffset, $to.parentOffset)
      if (!lastWrapper.checkContent(content, attrs[types.length - 1]))
        return StepResult.fail("Content can not be wrapped in ancestor " + lastWrapper.name)
      for (let i = types.length - 1; i >= 0; i--)
        content = Fragment.from(types[i].create(attrs[i], content))
      slice = new Slice(content, 0, 0)
    } else {
      slice = new Slice(inner.content, 0, 0)
    }
    return StepResult.fromReplace(doc, $from.pos - depth, $to.pos + depth, slice)
  },
  posMap(step) {
    let depth = step.param.depth || 0, newDepth = step.param.types ? step.param.types.length : 0
    if (depth == newDepth && depth < 2) return PosMap.empty
    return new PosMap([new ReplacedRange(step.from - depth, depth, newDepth),
                       new ReplacedRange(step.to, depth, newDepth)])
  },
  invert(step, oldDoc) {
    let types = [], attrs = []
    let $from = oldDoc.resolve(step.from)
    let oldDepth = step.param.depth || 0, newDepth = step.param.types ? step.param.types.length : 0
    for (let i = 0; i < oldDepth; i++) {
      let parent = $from.node($from.depth - i)
      types.unshift(parent.type)
      attrs.unshift(parent.attrs)
    }
    let dDepth = newDepth - oldDepth
    return new Step("ancestor", step.from + dDepth, step.to + dDepth, {depth: newDepth, types, attrs})
  },
  paramToJSON(param) {
    return {depth: param.depth,
            types: param.types && param.types.map(t => t.name),
            attrs: param.attrs}
  },
  paramFromJSON(schema, json) {
    return {depth: json.depth,
            types: json.types && json.types.map(n => schema.nodeType(n)),
            attrs: json.attrs}
  }
})

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
  if (from.before(shared) >= to.after(shared)) return null
  return shared
}

function findLiftable(from, to) {
  let shared = rangeDepth(from, to)
  if (shared == null) return null
  let parent = from.node(shared)
  for (let depth = shared - 1; depth >= 0; --depth)
    if (from.node(depth).type.canContainContent(parent.type))
      return {depth, shared, unwrap: false}

  if (parent.isBlock) for (let depth = shared - 1; depth >= 0; --depth) {
    let target = from.node(depth)
    for (let i = from.index(shared), e = Math.min(to.index(shared) + 1, parent.childCount); i < e; i++)
      if (!target.type.canContainContent(parent.child(i).type)) continue
    return {depth, shared, unwrap: true}
  }
}

// :: (number, ?number) → Transform
// Lift the nearest liftable ancestor of the [sibling
// range](#Node.siblingRange) of the given positions out of its
// parent (or do nothing if no such node exists).
Transform.prototype.lift = function(from, to = from, silent = false) {
  let $from = this.doc.resolve(from), $to = this.doc.resolve(to)
  let liftable = findLiftable($from, $to)
  if (!liftable) {
    if (!silent) throw new AssertionError("No valid lift target")
    return this
  }

  let {depth, shared, unwrap} = liftable
  let start = $from.before(shared + 1), end = $to.after(shared + 1)

  for (let d = shared; d > depth; d--) if ($to.index(d) + 1 < $to.node(d).childCount) {
    this.split($to.after(d + 1), d - depth)
    break
  }

  for (let d = shared; d > depth; d--) if ($from.index(d) > 0) {
    let cut = d - depth
    this.split($from.before(d + 1), cut)
    start += 2 * cut
    end += 2 * cut
    break
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
    shared++
    start++
    end--
  }
  return this.step("ancestor", start, end, {depth: shared - depth})
}

// :: (Node, number, ?number, NodeType) → bool
// Determines whether the [sibling range](#Node.siblingRange) of the
// given positions can be wrapped in the given node type.
export function canWrap(doc, from, to, type) {
  return !!checkWrap(doc.resolve(from), doc.resolve(to == null ? from : to), type)
}

function checkWrap($from, $to, type) {
  let shared = rangeDepth($from, $to)
  if (shared == null) return null
  let parent = $from.node(shared)
  let around = parent.type.findConnection(type)
  let inside = type.findConnection(parent.child($from.index(shared)).type)
  if (around && inside) return {shared, around, inside}
}

// :: (number, ?number, NodeType, ?Object) → Transform
// Wrap the [sibling range](#Node.siblingRange) of the given positions
// in a node of the given type, with the given attributes (if
// possible).
Transform.prototype.wrap = function(from, to = from, type, wrapAttrs) {
  let $from = this.doc.resolve(from), $to = this.doc.resolve(to)
  let check = checkWrap($from, $to, type)
  if (!check) throw new AssertionError("Wrap not possible")
  let {shared, around, inside} = check

  let types = around.concat(type).concat(inside)
  let attrs = around.map(() => null).concat(wrapAttrs).concat(inside.map(() => null))
  let start = $from.before(shared + 1)
  this.step("ancestor", start, $to.after(shared + 1), {types, attrs})
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
  this.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock && !node.hasMarkup(type, attrs)) {
      // Ensure all markup that isn't allowed in the new node type is cleared
      let start = pos + 1, end = start + node.content.size
      this.clearMarkup(start, end, type)
      this.step("ancestor", start, end,
                {depth: 1, types: [type], attrs: [attrs]})
      return false
    }
  })
  return this
}

// :: (number, NodeType, ?Object) → Transform
// Change the type and attributes of the node after `pos`.
Transform.prototype.setNodeType = function(pos, type, attrs) {
  let node = this.doc.nodeAt(pos)
  if (!node || !node.type.contains) throw new AssertionError("No content node at given position")
  return this.step("ancestor", pos + 1, pos + 1 + node.content.size, {depth: 1, types: [type], attrs: [attrs]})
}
