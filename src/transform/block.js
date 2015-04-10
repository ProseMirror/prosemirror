import {Pos, Node, slice, inline} from "../model"
import {Collapsed, defineTransform, Result, flatTransform} from "./transform"
import {glue} from "./replace"
import {resolveTarget, resolvePos, describePos} from "./resolve"
import {sameArray} from "./util"

export function selectedSiblings(doc, from, to) {
  for (let i = 0, node = doc;; i++) {
    if (node.type.contains == "inline")
      return {path: from.path.slice(0, i - 1), from: from.path[i - 1], to: from.path[i - 1] + 1}
    let fromEnd = i == from.path.length, toEnd = i == to.path.length
    let left = fromEnd ? from.offset : from.path[i]
    let right = toEnd ? to.offset : to.path[i]
    if (fromEnd || toEnd || left != right)
      return {path: from.path.slice(0, i), from: left, to: right}
    node = node.content[left]
  }
}

function canUnwrap(container, from, to) {
  let type = container.content[from].type.contains
  for (let i = from + 1; i < to; i++)
    if (container.content[i].type.contains != type)
      return false
  return type
}

export function liftRange(doc, from, to) {
  let range = selectedSiblings(doc, from, to)
  let found = canBeLifted(doc, range)
  if (found) {
    let fromDesc = describePos(doc, new Pos(range.path, range.from), "right")
    let toDesc = describePos(doc, new Pos(range.path, range.to), "left")
    return {name: "lift", pos: fromDesc.pos, posInfo: fromDesc.info,
            end: toDesc.pos, endInfo: toDesc.info}
  }
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

function resolveSiblingRange(doc, params) {
  let pos = resolvePos(doc, params.pos, params.posInfo)
  let end = resolvePos(doc, params.end, params.endInfo)
  if (pos && end && sameArray(pos.path, end.path) && pos.offset < end.offset)
    return {pos: pos, end: end}
}

function verifyLiftPos(doc, params) {
  let {pos, end} = resolveSiblingRange(doc, params)
  if (!pos) return null

  let range = {path: pos.path, from: pos.offset, to: end.offset}
  let lift = canBeLifted(doc, range)
  if (lift) return {range: range, lift: lift}
}

function lift(doc, params) {
  let {range, lift} = verifyLiftPos(doc, params)
  if (!range) return flatTransform(doc)

  let before = new Pos(range.path, range.from)
  while (before.path.length > lift.path.length && before.offset == 0)
    before = before.shorten()
  let after = new Pos(range.path, range.to)
  while (after.path.length > lift.path.length && after.offset == doc.path(after.path).content.length)
    after = after.shorten(null, 1)

  let output = slice.before(doc, before)
  let result = new Result(doc, output)
  let container = output.path(lift.path), size = container.content.length
  let source = doc.path(range.path)
  if (lift.unwrap) {
    for (let i = range.from; i < range.to; i++) {
      let node = source.content[i], path = range.path.concat(i)
      result.chunk(new Pos(path, 0), node.content.length,
                   new Pos(lift.path, container.content.length))
      container.pushFrom(source.content[i])
    }
  } else {
    result.chunk(new Pos(range.path, range.from), range.to - range.from,
                 new Pos(lift.path, container.content.length))
    container.pushFrom(source, range.from, range.to)
  }

  glue(output, lift.path.length, slice.after(doc, after), after, {result: result})

  return result
}

defineTransform("lift", {
  apply: lift,
  invert(result, params) {
    let {range, lift} = verifyLiftPos(result.before, params)
    if (!range) return {name: "null"}

    let parent = result.before.path(range.path)
    let join = range.from > 0 ? "left" : false
    if (range.to < parent.content.length) join = join ? true : "right"

    let start = Pos.shorten(range.path, lift.path.length)
    let end = Pos.shorten(range.path, lift.path.length, range.to - range.from)
    console.log("start/end=" + start + " " + end, "p=", range.path)

    return wrapRange(result.doc, start, end,
                     parent.type.name, parent.attrs, join)
  }
})

export function wrapRange(doc, from, to, type, attrs, join) {
  let range = selectedSiblings(doc, from, to)
  let descFrom = describePos(doc, new Pos(range.path, range.from), "right")
  let descTo = describePos(doc, new Pos(range.path, range.to), "left")
  return {name: "wrap", pos: descFrom.pos, posInfo: descFrom.info,
          end: descTo.pos, endInfo: descTo.info,
          type: type, attrs: attrs, join: join}
}

function wrap(doc, params) {
  let {pos, end} = resolveSiblingRange(doc, params)
  if (!pos) return flatTransform(doc)

  let range = {path: pos.path, from: pos.offset, to: end.offset}

  let source = doc.path(pos.path)
  let newNode = params.node || new Node(params.type, null, params.attrs)
  let connAround = Node.findConnection(source.type, newNode.type)
  let connInside = Node.findConnection(newNode.type, source.content[pos.offset].type)
  if (!connAround || !connInside) return flatTransform(doc)
  let outerNode = newNode
  for (let i = connAround.length - 1; i >= 0; i--)
    outerNode = new Node(connAround[i], [outerNode])

  let joinLeft = params.join && params.join != "right" && pos.offset &&
      outerNode.sameMarkup(source.content[pos.offset - 1])
  let joinRight = params.join && params.join != "left" && end.offset < source.content.length &&
      outerNode.sameMarkup(source.content[end.offset])

  let before = new Pos(pos.path, pos.offset - (joinLeft ? 1 : 0))
  let after = new Pos(pos.path, end.offset + (joinRight ? 1 : 0))
  let output = slice.before(doc, before)
  let result = new Result(doc, output)

  let leftStart = 0
  if (joinLeft) {
    let joinSource = source.content[pos.offset - 1]
    outerNode.content = joinSource.content.concat(outerNode.content)
    leftStart = joinSource.content.length
  }
  let prefix = pos.path.concat(pos.offset - (joinLeft ? 1 : 0)), suffix
  for (let i = 0; i < connAround.length; i++) {
    prefix.push(leftStart)
    leftStart = 0
  }
  if (!connInside.length) {
    result.chunk(pos, end.offset - pos.offset, new Pos(prefix, leftStart))
  } else {
    suffix = []
    for (let i = 1; i < connInside.length; i++) suffix.push(0)
  }

  for (let i = pos.offset; i < end.offset; i++) {
    let newChild = source.content[i]
    for (let i = connInside.length - 1; i >= 0; i--)
      newChild = new Node(connInside[i], [newChild])
    newNode.push(newChild)
    if (suffix) {
      let path = pos.path.concat(i)
      result.chunk(new Pos(pos.path, i), 1,
                   new Pos(prefix.concat(leftStart + i - pos.offset).concat(suffix), 0))
    }
  }

  if (joinRight) {
    let joinSource = source.content[end.offset]
    result.chunk(new Pos(pos.path.concat(end.offset), 0), joinSource.content.length,
                 new Pos(pos.path.concat(pos.offset - (joinLeft ? 1 : 0)), outerNode.content.length))
    outerNode.pushFrom(joinSource)
  }

  output.path(pos.path).push(outerNode)

  glue(output, pos.path.length, slice.after(doc, after), after, {result: result})
  return result
}

defineTransform("wrap", {
  apply: wrap,
  invert(result, params) {
    return liftRange(result.doc, resolvePos(result.doc, result.map(params.pos), result.posInfo),
                     resolvePos(result.doc, result.map(params.end), result.endInfo))
  }
})
