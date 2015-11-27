import {Pos, compareMarkup, siblingRange} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {isFlatRange} from "./tree"
import {PosMap, MovedRange, ReplacedRange} from "./map"

defineStep("ancestor", {
  apply(doc, step) {
    let from = step.from, to = step.to
    if (!isFlatRange(from, to)) return null
    let toParent = from.path, start = from.offset, end = to.offset
    let {depth = 0, types = [], attrs = []} = step.param
    let inner = doc.path(from.path)
    for (let i = 0; i < depth; i++) {
      if (start > 0 || end < doc.path(toParent).maxOffset || toParent.length == 0) return null
      start = toParent[toParent.length - 1]
      end = start + 1
      toParent = toParent.slice(0, toParent.length - 1)
    }
    if (depth == 0 && types.length == 0) return null

    let parent = doc.path(toParent), parentSize = parent.length, newParent
    if (parent.type.locked) return null
    if (types.length) {
      let lastWrapper = types[types.length - 1]
      let content = inner.slice(from.offset, to.offset)
      if (!parent.type.canContainType(types[0]) ||
          !content.every(n => lastWrapper.canContain(n)) ||
          !inner.length && !lastWrapper.canBeEmpty ||
          lastWrapper.locked)
        return null
      let node = null
      for (let i = types.length - 1; i >= 0; i--)
        node = types[i].create(attrs[i], node ? [node] : content)
      newParent = parent.splice(start, end, [node])
    } else {
      if (!parent.type.canContainChildren(inner, true) ||
          !inner.length && start == 0 && end == parent.length && !parent.type.canBeEmpty)
        return null
      newParent = parent.splice(start, end, inner.children)
    }
    let copy = doc.replaceDeep(toParent, newParent)

    let toInner = toParent.slice()
    for (let i = 0; i < types.length; i++) toInner.push(i ? 0 : start)
    let startOfInner = new Pos(toInner, types.length ? 0 : start)
    let replaced = null
    let insertedSize = types.length ? 1 : to.offset - from.offset
    if (depth != types.length || depth > 1 || types.length > 1) {
      let posBefore = new Pos(toParent, start)
      let posAfter1 = new Pos(toParent, end), posAfter2 = new Pos(toParent, start + insertedSize)
      let endOfInner = new Pos(toInner, startOfInner.offset + (to.offset - from.offset))
      replaced = [new ReplacedRange(posBefore, from, posBefore, startOfInner),
                  new ReplacedRange(to, posAfter1, endOfInner, posAfter2, posAfter1, posAfter2)]
    }
    let moved = [new MovedRange(from, to.offset - from.offset, startOfInner)]
    if (end - start != insertedSize)
      moved.push(new MovedRange(new Pos(toParent, end), parentSize - end,
                                new Pos(toParent, start + insertedSize)))
    return new TransformResult(copy, new PosMap(moved, replaced))
  },
  invert(step, oldDoc, map) {
    let types = [], attrs = []
    if (step.param.depth) for (let i = 0; i < step.param.depth; i++) {
      let parent = oldDoc.path(step.from.path.slice(0, step.from.path.length - i))
      types.unshift(parent.type)
      attrs.unshift(parent.attrs)
    }
    let newFrom = map.map(step.from).pos
    let newTo = step.from.cmp(step.to) ? map.map(step.to, -1).pos : newFrom
    return new Step("ancestor", newFrom, newTo, null,
                    {depth: step.param.types ? step.param.types.length : 0,
                     types, attrs})
  },
  paramToJSON(param) {
    return {depth: param.depth,
            types: param.types && param.types.map(t => t.name),
            attrs: param.attrs}
  },
  paramFromJSON(schema, json) {
    return {depth: json.depth,
            wrappers: json.types && json.types.map(n => schema.nodeType(n)),
            attrs: json.attrs}
  }
})

function canBeLifted(doc, range) {
  let content = [doc.path(range.from.path)], unwrap = false
  for (;;) {
    let parentDepth = -1
    for (let node = doc, i = 0; i < range.from.path.length; i++) {
      if (content.every(inner => node.type.canContainChildren(inner)))
        parentDepth = i
      node = node.child(range.from.path[i])
    }
    if (parentDepth > -1)
      return {path: range.from.path.slice(0, parentDepth), unwrap}
    if (unwrap || !content[0].isBlock) return null
    content = content[0].slice(range.from.offset, range.to.offset)
    unwrap = true
  }
}

export function canLift(doc, from, to) {
  let range = siblingRange(doc, from, to || from)
  let found = canBeLifted(doc, range)
  if (found) return {found, range}
}

Transform.prototype.lift = function(from, to = from) {
  let can = canLift(this.doc, from, to)
  if (!can) return this
  let {found, range} = can
  let depth = range.from.path.length - found.path.length
  let rangeNode = found.unwrap && this.doc.path(range.from.path)

  for (let d = 0, pos = range.to;; d++) {
    if (pos.offset < this.doc.path(pos.path).length) {
      this.split(pos, depth)
      break
    }
    if (d == depth - 1) break
    pos = pos.shorten(null, 1)
  }
  for (let d = 0, pos = range.from;; d++) {
    if (pos.offset > 0) {
      this.split(pos, depth - d)
      let cut = range.from.path.length - depth, path = pos.path.slice(0, cut).concat(pos.path[cut] + 1)
      while (path.length < range.from.path.length) path.push(0)
      range = {from: new Pos(path, 0), to: new Pos(path, range.to.offset - range.from.offset)}
      break
    }
    if (d == depth - 1) break
    pos = pos.shorten()
  }
  if (found.unwrap) {
    for (let i = range.to.offset - 1; i > range.from.offset; i--)
      this.join(new Pos(range.from.path, i))
    let size = 0
    for (let i = range.from.offset; i < range.to.offset; i++)
      size += rangeNode.child(i).length
    let path = range.from.path.concat(range.from.offset)
    range = {from: new Pos(path, 0), to: new Pos(path, size)}
    ++depth
  }
  this.step("ancestor", range.from, range.to, null, {depth: depth})
  return this
}

export function canWrap(doc, from, to, type) {
  let range = siblingRange(doc, from, to || from)
  if (range.from.offset == range.to.offset) return null
  let parent = doc.path(range.from.path)
  let around = parent.type.findConnection(type)
  let inside = type.findConnection(parent.child(range.from.offset).type)
  if (around && inside) return {range, around, inside}
}

Transform.prototype.wrap = function(from, to, type, wrapAttrs) {
  let can = canWrap(this.doc, from, to, type)
  if (!can) return this
  let {range, around, inside} = can
  let types = around.concat(type).concat(inside)
  let attrs = around.map(() => null).concat(wrapAttrs).concat(inside.map(() => null))
  this.step("ancestor", range.from, range.to, null, {types, attrs})
  if (inside.length) {
    let toInner = range.from.path.slice()
    for (let i = 0; i < around.length + inside.length + 1; i++)
      toInner.push(i ? 0 : range.from.offset)
    for (let i = range.to.offset - 1 - range.from.offset; i > 0; i--)
      this.split(new Pos(toInner, i), inside.length)
  }
  return this
}

export function alreadyHasBlockType(doc, from, to, type, attrs) {
  let found = false
  if (!attrs) attrs = {}
  doc.nodesBetween(from, to || from, node => {
    if (node.isTextblock) {
      if (!compareMarkup(node.type, type, node.attrs, attrs)) found = true
      return false
    }
  })
  return found
}

Transform.prototype.setBlockType = function(from, to, type, attrs) {
  this.doc.nodesBetween(from, to || from, (node, path) => {
    if (node.isTextblock && !compareMarkup(type, node.type, attrs, node.attrs)) {
      path = path.slice()
      // Ensure all markup that isn't allowed in the new node type is cleared
      this.clearMarkup(new Pos(path, 0), new Pos(path, node.maxOffset), type)
      this.step("ancestor", new Pos(path, 0), new Pos(path, this.doc.path(path).maxOffset),
                null, {depth: 1, types: [type], attrs: [attrs]})
      return false
    }
  })
  return this
}

Transform.prototype.setNodeType = function(pos, type, attrs) {
  let node = this.doc.path(pos.path).child(pos.offset)
  let path = pos.toPath()
  this.step("ancestor", new Pos(path, 0), new Pos(path, node.maxOffset), null,
            {depth: 1, types: [type], attrs: [attrs]})
  return this
}
