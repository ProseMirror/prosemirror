import {Node, findConnection} from "./node"

export function sliceBefore(node, pos, depth = 0) {
  let content
  if (depth < pos.depth) {
    let n = pos.path[depth]
    content = node.slice(0, n)
    content.push(sliceBefore(node.content[n], pos, depth + 1))
  } else {
    content = node.slice(0, pos.offset)
  }
  return node.copy(content)
}

export function sliceAfter(node, pos, depth = 0) {
  let content
  if (depth < pos.depth) {
    let n = pos.path[depth]
    content = node.slice(n + 1)
    content.unshift(sliceAfter(node.content[n], pos, depth + 1))
  } else {
    content = node.slice(pos.offset)
  }
  return node.copy(content)
}

export function sliceBetween(node, from, to, collapse = true, depth = 0) {
  if (depth < from.depth && depth < to.depth &&
      from.path[depth] == to.path[depth]) {
    var inner = sliceBetween(node.content[from.path[depth]], from, to, collapse, depth + 1)
    if (!collapse) return node.copy([inner])
    if (node.type.name != "doc") return inner
    var conn = findConnection(node.type, inner.type)
    for (let i = conn.length - 1; i >= 0; i--) inner = new Node(conn[i], null, [inner])
    return node.copy([inner])
  } else {
    let content
    if (depth == from.depth && depth == to.depth && node.type.block) {
      content = node.slice(from.offset, to.offset)
    } else {
      content = []
      let start
      if (depth < from.depth) {
        start = from.path[depth] + 1
        content.push(sliceAfter(node.content[start - 1], from, depth + 1))
      } else {
        start = from.offset
      }
      let end = depth < to.depth ? to.path[depth] : to.offset
      let between = node.slice(start, end)
      for (let i = 0; i < between.length; i++) content.push(between[i])
      if (depth < to.depth)
        content.push(sliceBefore(node.content[end], to, depth + 1))
    }
    return node.copy(content)
  }
}
