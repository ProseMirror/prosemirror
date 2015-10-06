import {Pos, $node, $fromJSON, findConnection} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {isFlatRange, selectedSiblings, blocksBetween, isPlainText} from "./tree"
import {PosMap, MovedRange, ReplacedRange} from "./map"

defineStep("ancestor", {
  apply(doc, step) {
    let from = step.from, to = step.to
    if (!isFlatRange(from, to)) return null
    let toParent = from.path, start = from.offset, end = to.offset
    let depth = step.param.depth || 0, wrappers = step.param.wrappers || []
    if (!depth && wrappers.length == 0) return null
    for (let i = 0; i < depth; i++) {
      if (start > 0 || end < doc.path(toParent).maxOffset || toParent.length == 0) return null
      start = toParent[toParent.length - 1]
      end = start + 1
      toParent = toParent.slice(0, toParent.length - 1)
    }

    let parent = doc.path(toParent), inner = doc.path(from.path), newParent
    let parentSize = parent.length
    if (wrappers.length) {
      let lastWrapper = wrappers[wrappers.length - 1]
      if (!parent.type.canContain(wrappers[0].type) ||
          lastWrapper.type.contains != inner.type.contains ||
          lastWrapper.type.plainText && !isPlainText(inner))
        return null
      let node = null
      for (let i = wrappers.length - 1; i >= 0; i--)
        node = wrappers[i].copy(node ? [node] : inner.slice(from.offset, to.offset))
      newParent = parent.splice(start, end, [node])
    } else {
      if (parent.type.contains != inner.type.contains) return null
      newParent = parent.splice(start, end, inner.children)
    }
    let copy = doc.replaceDeep(toParent, newParent)

    let toInner = toParent.slice()
    for (let i = 0; i < wrappers.length; i++) toInner.push(i ? 0 : start)
    let startOfInner = new Pos(toInner, wrappers.length ? 0 : start)
    let replaced = null
    let insertedSize = wrappers.length ? 1 : to.offset - from.offset
    if (depth != wrappers.length || depth > 1 || wrappers.length > 1) {
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
    let wrappers = []
    if (step.param.depth) for (let i = 0; i < step.param.depth; i++) {
      let parent = oldDoc.path(step.from.path.slice(0, step.from.path.length - i))
      wrappers.unshift(parent.copy())
    }
    let newFrom = map.map(step.from).pos
    let newTo = step.from.cmp(step.to) ? map.map(step.to, -1).pos : newFrom
    return new Step("ancestor", newFrom, newTo, null,
                    {depth: step.param.wrappers ? step.param.wrappers.length : 0,
                     wrappers: wrappers})
  },
  paramToJSON(param) {
    return {depth: param.depth,
            wrappers: param.wrappers && param.wrappers.map(n => n.toJSON())}
  },
  paramFromJSON(json) {
    return {depth: json.depth,
            wrappers: json.wrappers && json.wrappers.map($fromJSON)}
  }
})

function canUnwrap(container, from, to) {
  let type = container.child(from).type.contains
  for (let i = from + 1; i < to; i++)
    if (container.child(i).type.contains != type)
      return false
  return type
}

function canBeLifted(doc, range) {
  let container = doc.path(range.path)
  let parentDepth, unwrap = false, innerType = container.type.contains
  for (;;) {
    parentDepth = -1
    for (let node = doc, i = 0; i < range.path.length; i++) {
      if (node.type.contains == innerType) parentDepth = i
      node = node.child(range.path[i])
    }
    if (parentDepth > -1) return {path: range.path.slice(0, parentDepth),
                                  unwrap: unwrap}
    if (unwrap || !(innerType = canUnwrap(container, range.from, range.to))) return null
    unwrap = true
  }
}

export function canLift(doc, from, to) {
  let range = selectedSiblings(doc, from, to || from)
  let found = canBeLifted(doc, range)
  if (found) return {found, range}
}

Transform.prototype.lift = function(from, to = from) {
  let can = canLift(this.doc, from, to)
  if (!can) return this
  let {found, range} = can
  let depth = range.path.length - found.path.length
  let rangeNode = found.unwrap && this.doc.path(range.path)

  for (let d = 0, pos = new Pos(range.path, range.to);; d++) {
    if (pos.offset < this.doc.path(pos.path).length) {
      this.split(pos, depth)
      break
    }
    if (d == depth - 1) break
    pos = pos.shorten(null, 1)
  }
  for (let d = 0, pos = new Pos(range.path, range.from);; d++) {
    if (pos.offset > 0) {
      this.split(pos, depth - d)
      let cut = range.path.length - depth, path = pos.path.slice(0, cut).concat(pos.path[cut] + 1)
      while (path.length < range.path.length) path.push(0)
      range = {path: path, from: 0, to: range.to - range.from}
      break
    }
    if (d == depth - 1) break
    pos = pos.shorten()
  }
  if (found.unwrap) {
    for (let i = range.to - 1; i > range.from; i--)
      this.join(new Pos(range.path, i))
    let size = 0
    for (let i = range.from; i < range.to; i++)
      size += rangeNode.child(i).length
    range = {path: range.path.concat(range.from), from: 0, to: size}
    ++depth
  }
  this.step("ancestor", new Pos(range.path, range.from),
            new Pos(range.path, range.to), null, {depth: depth})
  return this
}

export function canWrap(doc, from, to, node) {
  let range = selectedSiblings(doc, from, to || from)
  if (range.from == range.to) return null
  let parent = doc.path(range.path)
  let around = parent.type.findConnection(node.type)
  let inside = node.type.findConnection(parent.child(range.from).type)
  if (around && inside) return {range, around, inside}
}

Transform.prototype.wrap = function(from, to, node) {
  let can = canWrap(this.doc, from, to, node)
  if (!can) return this
  let {range, around, inside} = can
  let wrappers = around.map(t => $node(t)).concat(node).concat(inside.map(t => $node(t)))
  this.step("ancestor", new Pos(range.path, range.from), new Pos(range.path, range.to),
            null, {wrappers: wrappers})
  if (inside.length) {
    let toInner = range.path.slice()
    for (let i = 0; i < around.length + inside.length + 1; i++)
      toInner.push(i ? 0 : range.from)
    for (let i = range.to - 1 - range.from; i > 0; i--)
      this.split(new Pos(toInner, i), inside.length)
  }
  return this
}

Transform.prototype.setBlockType = function(from, to, wrapNode) {
  blocksBetween(this.doc, from, to || from, (node, path) => {
    path = path.slice()
    if (wrapNode.type.plainText && !isPlainText(node))
      this.clearMarkup(new Pos(path, 0), new Pos(path, node.maxOffset))
    this.step("ancestor", new Pos(path, 0), new Pos(path, node.maxOffset),
              null, {depth: 1, wrappers: [wrapNode]})
  })
  return this
}
