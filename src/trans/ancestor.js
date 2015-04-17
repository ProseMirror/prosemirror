import {Pos, Node, inline} from "../model"

import {defineStep, Result, Step, Transform} from "./transform"
import {isFlatRange, copyTo, selectedSiblings, blocksBetween, isPlainText} from "./tree"
import {PosMap, MovedRange, CollapsedRange} from "./map"

defineStep("ancestor", {
  apply(doc, data) {
    let from = data.from, to = data.to
    if (!isFlatRange(from, to)) return null
    let toParent = from.path, start = from.offset, end = to.offset
    let depth = data.param.depth || 0, wrappers = data.param.wrappers || Node.empty
    if (!depth && wrappers.length == 0) return null
    for (let i = 0; i < depth; i++) {
      if (start > 0 || end < doc.path(toParent).maxOffset || toParent.length == 0) return null
      start = toParent[toParent.length - 1]
      end = start + 1
      toParent = toParent.slice(0, toParent.length - 1)
    }
    let copy = copyTo(doc, toParent)
    let parent = copy.path(toParent), inner = copy.path(from.path)
    let parentSize = parent.content.length
    if (wrappers.length) {
      let lastWrapper = wrappers[wrappers.length - 1]
      if (parent.type.contains != wrappers[0].type.type ||
          lastWrapper.type.contains != inner.type.contains ||
          lastWrapper.type.plainText && !isPlainText(inner))
        return null
      let node = null
      for (let i = wrappers.length - 1; i >= 0; i--)
        node = wrappers[i].copy(node ? [node] : inner.content.slice(from.offset, to.offset))
      parent.content.splice(start, end - start, node)
    } else {
      if (parent.type.contains != inner.type.contains) return null
      parent.content = parent.content.slice(0, start).concat(inner.content).concat(parent.content.slice(end))
    }

    let toInner = toParent.slice()
    for (let i = 0; i < wrappers.length; i++) toInner.push(i ? 0 : start)
    let startOfInner = new Pos(toInner, wrappers.length ? 0 : start)
    let deleted = null, inserted = null
    let insertedSize = wrappers.length ? 1 : to.offset - from.offset
    if (depth > 1 || wrappers.length > 1) {
      let posBefore = new Pos(toParent, start)
      let posAfter1 = new Pos(toParent, end), posAfter2 = new Pos(toParent, start + insertedSize)
      let endOfInner = new Pos(toInner, startOfInner.offset + (to.offset - from.offset))
      if (depth > 1)
        deleted = [new CollapsedRange(posBefore, from, posBefore, startOfInner),
                   new CollapsedRange(to, posAfter1, endOfInner, posAfter2)]
      if (wrappers.length > 1)
        inserted = [new CollapsedRange(posBefore, startOfInner, posBefore, from),
                    new CollapsedRange(endOfInner, posAfter2, to, posAfter1)]
    }
    let moved = [new MovedRange(from, to.offset - from.offset, startOfInner)]
    if (end - start != insertedSize)
      moved.push(new MovedRange(new Pos(toParent, end), parentSize - end,
                                new Pos(toParent, start + insertedSize)))
    return new Result(doc, copy, new PosMap(moved, deleted, inserted))
  },
  invert(result, data) {
    let wrappers = []
    if (data.param.depth) for (let i = 0; i < data.param.depth; i++) {
      let parent = result.before.path(data.from.path.slice(0, data.from.path.length - i))
      wrappers.unshift(parent.copy())
    }
    return new Step("ancestor", result.map.map(data.from), result.map.map(data.to, -1),
                    {depth: data.param.wrappers ? data.param.wrappers.length : 0,
                     wrappers: wrappers})
  }
})

function canUnwrap(container, from, to) {
  let type = container.content[from].type.contains
  for (let i = from + 1; i < to; i++)
    if (container.content[i].type.contains != type)
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
      node = node.content[range.path[i]]
    }
    if (parentDepth > -1) return {path: range.path.slice(0, parentDepth),
                                  unwrap: unwrap}
    if (unwrap || !(innerType = canUnwrap(container, range.from, range.to))) return null
    unwrap = true
  }
}

Transform.prototype.lift = function(from, to) {
  let range = selectedSiblings(this.doc, from, to || from)
  let found = canBeLifted(this.doc, range)
  let depth = range.path.length - found.path.length
  if (!found) return this

  for (let d = 0, pos = new Pos(range.path, range.to);; d++) {
    if (pos.offset < this.doc.path(pos.path).content.length) {
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
      for (let i = 0; i < d; i++) path.push(0)
      range = {path: path, from: 0, to: range.to - range.from}
      break
    }
    if (d == depth - 1) break
    pos = pos.shorten()
  }
  if (found.unwrap) {
    for (let i = range.to - 1; i > range.from; i--)
      this.join(new Pos(range.path, i))
    let node = this.doc.path(range.path), size = 0
    for (let i = range.from; i < range.to; i++)
      size += node.content[i].content.length
    range = {path: range.path.concat(range.from), from: 0, to: size}
    ++depth
  }
  this.addStep("ancestor", new Pos(range.path, range.from),
               new Pos(range.path, range.to), {depth: depth})
  return this
}

Transform.prototype.wrap = function(from, to, node) {
  let range = selectedSiblings(this.doc, from, to || from)
  let parent = this.doc.path(range.path)
  let around = Node.findConnection(parent.type, node.type)
  let inside = Node.findConnection(node.type, parent.content[range.from].type)
  if (!around || !inside) return this
  let wrappers = around.map(t => new Node(t)).concat(node).concat(inside.map(t => new Node(t)))
  this.addStep("ancestor", new Pos(range.path, range.from), new Pos(range.path, range.to),
               {wrappers: wrappers})
  if (inside.length) {
    let toInner = range.path.slice()
    for (let i = around.length + inside.length + 1; i > 0; i--)
      toInner.push(0)
    for (let i = range.to - 1 - range.from; i > 0; i--)
      this.split(new Pos(toInner, i), inside.length)
  }
  return this
}

Transform.prototype.setBlockType = function(from, to, wrapNode) {
  blocksBetween(this.doc, from, to || from, (node, path) => {
    path = path.slice()
    if (wrapNode.type.plainText && !isPlainText(node))
      this.clearMarkup(new Pos(path, 0), new Pos(path, node.size))
    this.addStep("ancestor", new Pos(path, 0), new Pos(path, node.size),
                 {depth: 1, wrappers: [wrapNode]})
  })
  return this
}
