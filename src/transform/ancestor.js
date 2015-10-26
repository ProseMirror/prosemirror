import {Pos, compareMarkup, siblingRange} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {isFlatRange, blocksBetween, isPlainText} from "./tree"
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
          !lastWrapper.type.canContainChildren(inner))
        return null
      let node = null
      for (let i = wrappers.length - 1; i >= 0; i--)
        node = wrappers[i].copy(node ? [node] : inner.slice(from.offset, to.offset))
      newParent = parent.splice(start, end, [node])
    } else {
      if (!parent.type.canContainChildren(inner)) return null
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
  paramFromJSON(schema, json) {
    return {depth: json.depth,
            wrappers: json.wrappers && json.wrappers.map(schema.nodeFromJSON)}
  }
})

function canBeLifted(doc, range) {
  let content = [doc.path(range.from.path)], unwrap = false
  for (;;) {
    let parentDepth = -1
    for (let node = doc, i = 0; i < range.from.path.length; i++) {
      if (content.every(inner => node.type.canContainContent(inner)))
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

export function canWrap(doc, from, to, node) {
  let range = siblingRange(doc, from, to || from)
  if (range.from.offset == range.to.offset) return null
  let parent = doc.path(range.from.path)
  let around = parent.type.findConnection(node.type)
  let inside = node.type.findConnection(parent.child(range.from.offset).type)
  if (around && inside) return {range, around, inside}
}

Transform.prototype.wrap = function(from, to, node) {
  let can = canWrap(this.doc, from, to, node)
  if (!can) return this
  let {range, around, inside} = can
  let wrappers = around.map(t => node.type.schema.node(t))
                   .concat(node)
                   .concat(inside.map(t => node.type.schema.node(t)))
  this.step("ancestor", range.from, range.to, null, {wrappers})
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
  blocksBetween(doc, from, to || from, node => {
    if (!compareMarkup(node.type, type, node.attrs, attrs)) found = true
  })
  return found
}

Transform.prototype.setBlockType = function(from, to, wrapNode) {
  blocksBetween(this.doc, from, to || from, (node, path) => {
    path = path.slice()
    if (wrapNode.type.plainText && !isPlainText(node))
      this.clearMarkup(new Pos(path, 0), new Pos(path, node.maxOffset))
    this.step("ancestor", new Pos(path, 0), new Pos(path, this.doc.path(path).maxOffset),
              null, {depth: 1, wrappers: [wrapNode]})
  })
  return this
}
