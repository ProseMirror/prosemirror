export default class Pos {
  constructor(path, offset, inBlock = true) {
    this.path = path
    this.offset = offset
    this.inBlock = inBlock
  }

  toString() {
    return this.path.join("/") + ":" + this.offset + (this.inBlock ? "" : "#")
  }

  cmp(other) {
    let len = this.path.length, oLen = other.path.length;
    for (var i = 0, end = Math.min(len, oLen); i < end; i++) {
      var diff = this.path[i] - other.path[i]
      if (diff != 0) return diff
    }
    if (len > oLen)
      return other.offset <= this.path[i] ? 1 : -1
    else if (oLen > len)
      return this.offset <= other.path[i] ? -1 : 1
    else
      return this.offset - other.offset
  }
}

function findLeft(node, path) {
  if (node.type.contains == "inline")
    return new Pos(path, 0)
  for (let i = 0; i < node.content.length; i++) {
    path.push(i)
    let found = findLeft(node.content[i], path)
    if (found) return found
    path.pop()
  }
}

function findAfter(node, pos, path) {
  if (node.type.contains == "inline")
    return pos
  let atEnd = path.length == pos.path.length
  let start = atEnd ? pos.offset : pos.path[path.length]
  for (let i = start; i < node.content.length; i++) {
    path.push(i)
    let child = node.content[i]
    let found = i == start && !atEnd ? findAfter(child, pos, path) : findLeft(child, path)
    if (found) return found
    path.pop()
  }
}

Pos.after = function(node, pos) { return findAfter(node, pos, []) }
Pos.start = function(node) { return findLeft(node, []) }

function findRight(node, path) {
  if (node.type.contains == "inline")
    return new Pos(path, node.size)
  for (let i = node.content.length - 1; i >= 0; i--) {
    path.push(i)
    let found = findRight(node.content[i], path)
    if (found) return found
    path.pop()
  }
}

function findBefore(node, pos, path) {
  if (node.type.contains == "inline") return pos
  let atEnd = pos.path.length == path.length
  let end = atEnd ? pos.offset - 1 : pos.path[path.length]
  for (let i = end; i >= 0; i--) {
    path.push(i)
    let child = node.content[i]
    let found = i == end && !atEnd ? findBefore(child, pos, path) : findRight(child, path)
    if (found) return found
    path.pop()
  }
}

Pos.before = function(node, pos) { return findbefore(node, pos, []) }
Pos.end = function(node) { return findRight(node, []) }
