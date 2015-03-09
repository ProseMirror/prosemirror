// Primitive block-based transformations

import Pos from "./pos"
import PosMap from "./posmap"
import * as slice from "./slice"
import * as join_ from "./join"

export function selectedSiblings(doc, from, to) {
  let len = Math.min(from.path.length, to.path.length)
  for (let i = 0;; i++) {
    let left = from.path[i], right = to.path[i]
    if (left != right || i == len - 1)
      return {path: from.path.slice(0, i), from: left, to: right + 1}
  }
}

function canUnwrap(container, from, to) {
  var type = container.content[from].type.contains
  for (let i = from + 1; i < to; i++)
    if (container.content[i].type.contains != type)
      return false
  return type
}

export function canBeLifted(doc, from, to) {
  let range = selectedSiblings(doc, from, to)
  let container = doc.path(range.path)
  let parentDepth, unwrap = false, innerType = container.type.contains
  for (;;) {
    parentDepth = -1
    for (let node = doc, i = 0; i < range.path.length; i++) {
      if (node.type.contains == innerType) parentDepth = i
      node = node.content[range.path[i]]
    }
    if (parentDepth > -1) return {
      range: range,
      path: range.path.slice(0, parentDepth),
      unwrap: unwrap
    }
    if (unwrap || !(innerType = canUnwrap(container, range.from, range.to))) return null
    unwrap = true
  }
}

export function lift(doc, from, to) {
  let lift = canBeLifted(doc, from, to)
  if (!lift) return PosMap.noOp(doc)
  let range = lift.range

  let before = new Pos(range.path, range.from, false)
  while (before.path.length > lift.path.length && before.offset == 0)
    before = new Pos(before.path.slice(0, before.path.length - 1), before.path[before.path.length - 1], false)
  let after = new Pos(range.path, range.to, false)
  while (after.path.length > lift.path.length && after.offset == doc.path(after.path).content.length)
    after = new Pos(after.path.slice(0, after.path.length - 1), after.path[after.path.length - 1] + 1, false)

  let posMap = new PosMap(doc, before)
  let result = slice.before(doc, before)
  let container = result.path(lift.path), size = container.content.length
  let source = doc.path(range.path)
  if (lift.unwrap) {
    for (let i = range.from; i < range.to; i++)
      container.pushFrom(source.content[i])
  } else {
    container.pushFrom(source, range.from, range.to)
  }

  posMap.chunk(after, pos => {
    let origOffset = pos.path[range.path.length]
    let offset = size - range.from
    if (lift.unwrap) {
      offset += pos.path[range.path.length + 1]
      for (let i = range.from; i < origOffset; i++)
        offset += source.content[i].content.length
    } else {
      offset += origOffset
    }
    let path = lift.path.concat(offset).concat(pos.path.slice(lift.path.length + (lift.unwrap ? 3 : 2)))
    return new Pos(path, pos.offset)
  })

  join_.buildPosMap(posMap, after, result, lift.path.length,
                    slice.after(doc, after), after, true)

  return {doc: result, map: posMap}
}

export function joinPoint(doc, pos) {
  let joinDepth = -1
  for (let i = 0, parent = doc; i < pos.path.length; i++) {
    let index = pos.path[i]
    if (index > 0 && parent.content[index - 1].type == parent.content[index].type)
      joinDepth = i
    parent = parent.content[index]
  }
  if (joinDepth > -1) return new Pos(pos.path.slice(0, joinDepth), pos.path[joinDepth], false)
}

export function join(doc, pos) {
  let point = joinPoint(doc, pos)
  if (!point) return PosMap.noOp(doc)

  let posMap = new PosMap(doc, point)
  let result = slice.before(doc, point)

  let toJoined = point.path.concat(point.offset - 1)
  let target = result.path(toJoined)
  let size = target.content.length
  let source = doc.path(point.path.concat(point.offset))
  target.pushFrom(source)
  let after = new Pos(point.path, point.offset + 1, false)
  posMap.chunk(after, pos => {
    let offset = pos.path[toJoined.length] + size
    return new Pos(toJoined.concat(offset).concat(pos.path.slice(toJoined.length + 1)), pos.offset)
  })

  join_.buildPosMap(posMap, after, result, point.path.length + 1,
                    slice.after(doc, after), after, true)
  return {doc: result, map: posMap} // FIXME just return posmaps from these
}
