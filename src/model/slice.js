import {Pos} from "./pos"

// FIXME move to node methods

export function childrenBefore(node, pos, depth = 0) {
  if (depth == pos.depth)
    return node.slice(0, pos.offset)

  let n = pos.path[depth]
  return node.slice(0, n).concat(sliceBefore(node.child(n), pos, depth + 1))
}

export function sliceBefore(node, pos, depth = 0) {
  return node.copy(childrenBefore(node, pos, depth))
}

export function childrenAfter(node, pos, depth = 0) {
  if (depth == pos.depth)
    return node.slice(pos.offset)
  let n = pos.path[depth]
  let content = node.slice(n + 1)
  content.unshift(sliceAfter(node.child(n), pos, depth + 1))
  return content
}

export function sliceAfter(node, pos, depth = 0) {
  return node.copy(childrenAfter(node, pos, depth))
}

export function childrenBetween(node, from, to, depth = 0) {
  let fromEnd = depth == from.depth, toEnd = depth == to.depth
  if (fromEnd && toEnd)
    return node.slice(from.offset, to.offset)
  if (!fromEnd && !toEnd && from.path[depth] == to.path[depth])
    return [sliceBetween(node.child(from.path[depth]), from, to, false, depth + 1)]

  let content = [], start
  if (!fromEnd) {
    start = from.path[depth] + 1
    content.push(sliceAfter(node.child(start - 1), from, depth + 1))
  } else {
    start = from.offset
  }
  let end = toEnd ? to.offset : to.path[depth]
  let between = node.slice(start, end)
  for (let i = 0; i < between.length; i++) content.push(between[i])
  if (!toEnd) content.push(sliceBefore(node.child(end), to, depth + 1))
  return content
}

export function sliceBetween(node, from, to, collapse = true, depth = 0) {
  if (depth < from.depth && depth < to.depth &&
      from.path[depth] == to.path[depth]) {
    var inner = sliceBetween(node.child(from.path[depth]), from, to, collapse, depth + 1)
    if (!collapse) return node.copy([inner])
    if (node.type.name != "doc") return inner
    var conn = node.type.findConnection(inner.type)
    for (let i = conn.length - 1; i >= 0; i--) inner = node.type.schema.node(conn[i], null, [inner])
    return node.copy([inner])
  } else {
    return node.copy(childrenBetween(node, from, to, depth))
  }
}

export function siblingRange(doc, from, to) {
  for (let i = 0, node = doc;; i++) {
    if (node.isTextblock) {
      let path = from.path.slice(0, i - 1), offset = from.path[i - 1]
      return {from: new Pos(path, offset), to: new Pos(path, offset + 1)}
    }
    let fromEnd = i == from.path.length, toEnd = i == to.path.length
    let left = fromEnd ? from.offset : from.path[i]
    let right = toEnd ? to.offset : to.path[i]
    if (fromEnd || toEnd || left != right) {
      let path = from.path.slice(0, i)
      return {from: new Pos(path, left), to: new Pos(path, right + (toEnd ? 0 : 1))}
    }
    node = node.child(left)
  }
}
