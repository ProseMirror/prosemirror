import {Pos, Slice, Fragment} from "../model"

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

function isFlatRange(from, to) {
  if (from.depth != to.depth) return false
  for (let i = 0; i < from.depth; i++)
    if (from.index[i] != to.index[i]) return false
  return from.parentOffset <= to.parentOffset
}

Step.define("ancestor", {
  apply(doc, step) {
    let from = doc.resolve(step.from), to = doc.resolve(step.to)
    if (!isFlatRange(from, to)) return StepResult.fail("Not a flat range")

    let {depth = 0, types = [], attrs = []} = step.param
    if (depth == 0 && types.length == 0) return StepResult.ok(doc)

    let startDepth = from.depth
    for (let i = 0; i < depth; i++) {
      let parent = from.node[startDepth]
      if (from.offset[startDepth] > 0 || to.offset[startDepth] < parent.content.size)
        return StepResult.fail("Parent at depth " + i + " not fully covered")
      startDepth--
    }

    let inner = from.parent, slice
    if (types.length) {
      let lastWrapper = types[types.length - 1]
      let content = inner.content.cut(from.parentOffset, to.parentOffset)
      if (!lastWrapper.checkContent(content, attrs[types.length - 1]))
        return StepResult.fail("Content can not be wrapped in ancestor " + lastWrapper.name)
      for (let i = types.length - 1; i >= 0; i--)
        content = Fragment.from(types[i].create(attrs[i], content))
      slice = new Slice(content, 0, 0)
    } else {
      slice = new Slice(inner.content, 0, 0)
    }
    return StepResult.fromReplace(doc, from.pos - depth, to.pos + depth, slice)
  },
  posMap(step) {
    let depth = step.param.depth || 0, newDepth = step.param.types ? step.param.types.length : 0
    return new PosMap([new ReplacedRange(step.from - depth, depth, newDepth),
                       new ReplacedRange(step.to, depth, newDepth)])
  },
  invert(step, oldDoc) {
    let types = [], attrs = []
    let from = oldDoc.resolve(step.from)
    let oldDepth = step.param.depth || 0, newDepth = step.param.types ? step.param.types.length : 0
    for (let i = 0; i < oldDepth; i++) {
      let parent = from.node[from.depth - i]
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
  return !!findLiftable(doc.resolve(from), doc.resolve(to))
}

function findLiftable(from, to) {
  let shared = from.sameDepth(to)
  if (from.node[shared].isTextblock) --shared
  let parent = from.node[shared]
  for (let depth = shared - 1; depth >= 0; --depth)
    if (from.node[depth].type.canContainContent(parent.type))
      return {depth, shared, unwrap: false}

  if (parent.isBlock) for (let depth = shared - 1; depth >= 0; --depth) {
    let target = from.node[depth]
    for (let i = from.index[shared], e = Math.min(to.index[shared] + 1, parent.childCount); i < e; i++)
      if (!target.type.canContainContent(parent.child(i).type)) continue
    return {depth, shared, unwrap: true}
  }
}

// :: (Pos, ?Pos) → Transform
// Lift the nearest liftable ancestor of the [sibling
// range](#Node.siblingRange) of the given positions out of its
// parent (or do nothing if no such node exists).
Transform.define("lift", function(from, to = from) {
  let rFrom = this.doc.resolve(from), rTo = this.doc.resolve(to)
  let liftable = findLiftable(rFrom, rTo)
  if (!liftable) return this.fail("No valid lift target")

  let {depth, shared, unwrap} = liftable
  let start = rFrom.before(shared + 1), end = rTo.after(shared + 1)
  let result = this

  for (let d = shared; d > depth; d--) if (rTo.index[d] < rTo.node[d].childCount) {
    result = result.split(rTo.after(d + 1), d - depth)
    break
  }

  for (let d = shared; d > depth; d--) if (rFrom.index[d] > 0) {
    let cut = d - depth
    result = result.split(rFrom.before(d + 1), cut)
    start += 2 * cut
    end += 2 * cut
    break
  }

  if (unwrap) {
    start++
    end--
    let joinPos = start
    for (let i = rFrom.index[shared], e = rTo.index[shared] + 1, first = true; i < e; i++, first = false) {
      if (!first) result = result.join(joinPos)
      joinPos += parent.child(i).nodeSize
      end -= 2
    }
    shared++
  }
  return result.step("ancestor", start, end, {depth: shared - depth})
})

// :: (Node, Pos, ?Pos, NodeType) → bool
// Determines whether the [sibling range](#Node.siblingRange) of the
// given positions can be wrapped in the given node type.
export function canWrap(doc, from, to, type) {
  let range = doc.siblingRange(from, to || from)
  if (range.from.offset == range.to.offset) return null
  let parent = doc.path(range.from.path)
  let around = parent.type.findConnection(type)
  let inside = type.findConnection(parent.child(range.from.offset).type)
  if (around && inside) return {range, around, inside}
}

// :: (Pos, ?Pos, NodeType, ?Object) → Transform
// Wrap the [sibling range](#Node.siblingRange) of the given positions
// in a node of the given type, with the given attributes (if
// possible).
Transform.prototype.wrap = function(from, to, type, wrapAttrs) {
  let can = canWrap(this.doc, from, to, type)
  if (!can) return this
  let {range, around, inside} = can
  let types = around.concat(type).concat(inside)
  let attrs = around.map(() => null).concat(wrapAttrs).concat(inside.map(() => null))
  this.step("ancestor", range.from, range.to, {types, attrs})
  if (inside.length) {
    let toInner = range.from.path.slice()
    for (let i = 0; i < around.length + inside.length + 1; i++)
      toInner.push(i ? 0 : range.from.offset)
    for (let i = range.to.offset - 1 - range.from.offset; i > 0; i--)
      this.split(new Pos(toInner, i), inside.length)
  }
  return this
}

// :: (Pos, ?Pos, NodeType, ?Object) → Transform
// Set the type of all textblocks (partly) between `from` and `to` to
// the given node type with the given attributes.
Transform.prototype.setBlockType = function(from, to, type, attrs) {
  this.doc.nodesBetween(from, to || from, (node, path) => {
    if (node.isTextblock && !node.hasMarkup(type, attrs)) {
      path = path.slice()
      // Ensure all markup that isn't allowed in the new node type is cleared
      this.clearMarkup(new Pos(path, 0), new Pos(path, node.size), type)
      this.step("ancestor", new Pos(path, 0), new Pos(path, this.doc.path(path).size),
                {depth: 1, types: [type], attrs: [attrs]})
      return false
    }
  })
  return this
}

// :: (Pos, NodeType, ?Object) → Transform
// Change the type and attributes of the node after `pos`.
Transform.prototype.setNodeType = function(pos, type, attrs) {
  let node = this.doc.nodeAfter(pos)
  let path = pos.toPath()
  this.step("ancestor", new Pos(path, 0), new Pos(path, node.size),
            {depth: 1, types: [type], attrs: [attrs]})
  return this
}
