import Node from "./node"

function copyInlineTo(node, offset, copy) {
  for (let left = offset, i = 0; left > 0; i++) {
    let chunk = node.content[i]
    if (!chunk) console.log("searhcing for " + offset + " in " + node)
    if (chunk.text.length <= left) {
      left -= chunk.text.length
      copy.push(chunk)
    } else {
      copy.push(chunk.slice(0, left))
      break
    }
  }
}

function copyInlineFrom(node, offset, copy) {
  for (let before = offset, i = 0; i < node.content.length; i++) {
    let chunk = node.content[i]
    if (before == 0) {
      copy.push(chunk)
    } else if (chunk.text.length <= before) {
      before -= chunk.text.length
    } else {
      copy.push(chunk.slice(before))
      before = 0
    }
  }
}

function copyInlineBetween(node, from, to, copy) {
  for (let pos = 0, i = 0; pos < to; i++) {
    var chunk = node.content[i], size = chunk.text.length
    if (pos < from) {
      if (pos + size > from)
        copy.push(chunk.slice(from - pos, Math.min(to - pos, size)))
    } else if (pos + size <= to) {
      copy.push(chunk)
    } else {
      copy.push(chunk.slice(0, to - pos))
    }
    pos += size
  }
}

export function before(node, pos, depth = 0) {
  let copy = node.copy()
  if (depth < pos.path.length) {
    let n = pos.path[depth]
    copy.pushFrom(node, 0, n)
    copy.push(before(node.content[n], pos, depth + 1))
  } else if (node.type.contains != "inline") {
    copy.pushFrom(node, 0, pos.offset)
  } else {
    copyInlineTo(node, pos.offset, copy)
  }
  return copy
}

export function after(node, pos, depth = 0) {
  let copy = node.copy()
  if (depth < pos.path.length) {
    let n = pos.path[depth]
    copy.push(after(node.content[n], pos, depth + 1))
    copy.pushFrom(node, n + 1)
  } else if (node.type.contains != "inline") {
    copy.pushFrom(node, pos.offset)
  } else {
    copyInlineFrom(node, pos.offset, copy)
  }
  return copy
}

export function between(node, from, to, collapse = true, depth = 0) {
  if (depth < from.path.length && depth < to.path.length &&
      from.path[depth] == to.path[depth]) {
    var inner = between(node.content[from.path[depth]], from, to, collapse, depth + 1)
    if (!collapse) return node.copy([inner])
    if (node.type.name != "doc") return inner
    var conn = Node.findConnection(node.type, inner.type)
    for (let i = conn.length - 1; i >= 0; i--) inner = new Node(conn[i], [inner])
    return node.copy([inner])
  } else {
    var copy = node.copy()
    if (depth == from.path.length && depth == to.path.length && node.type.contains == "inline") {
      copyInlineBetween(node, from.offset, to.offset, copy)
    } else {
      let start
      if (depth < from.path.length) {
        start = from.path[depth] + 1
        copy.push(after(node.content[start - 1], from, depth + 1))
      } else {
        start = from.offset;
      }
      let end = depth < to.path.length ? to.path[depth] : to.offset
      copy.pushFrom(node, start, end)
      if (depth < to.path.length)
        copy.push(before(node.content[end], to, depth + 1))
    }
    return copy
  }
}        
