export class Pos {
  constructor(path, offset) {
    this.path = path
    this.offset = offset
  }

  toString() {
    return this.path.join("/") + ":" + this.offset
  }

  get depth() {
    return this.path.length
  }

  static cmp(pathA, offsetA, pathB, offsetB) {
    let lenA = pathA.length, lenB = pathB.length
    for (var i = 0, end = Math.min(lenA, lenB); i < end; i++) {
      var diff = pathA[i] - pathB[i]
      if (diff != 0) return diff
    }
    if (lenA > lenB)
      return offsetB <= pathA[i] ? 1 : -1
    else if (lenB > lenA)
      return offsetA <= pathB[i] ? -1 : 1
    else
      return offsetA - offsetB
  }

  static samePath(pathA, pathB) {
    if (pathA.length != pathB.length) return false
    for (let i = 0; i < pathA.length; i++) if (pathA[i] !== pathB[i]) return false
    return true
  }

  cmp(other) { return Pos.cmp(this.path, this.offset, other.path, other.offset) }

  static shorten(path, to = null, offset = 0) {
    if (to == null) to = path.length - 1
    return new Pos(path.slice(0, to), path[to] + offset)
  }

  shorten(to = null, offset = 0) {
    if (to >= this.depth) return this
    return Pos.shorten(this.path, to, offset)
  }

  shift(by) {
    return new Pos(this.path, this.offset + by)
  }

  extend(pos) {
    let path = this.path.slice(), add = this.offset
    for (let i = 0; i < pos.path.length; i++) {
      path.push(pos.path[i] + add)
      add = 0
    }
    return new Pos(path, pos.offset + add)
  }

  toJSON() { return this }

  static fromJSON(json) { return new Pos(json.path, json.offset) }

  static after(node, pos) { return findAfter(node, pos, []) }
  static start(node) { return findLeft(node, []) }

  static before(node, pos) { return findBefore(node, pos, []) }
  static end(node) { return findRight(node, []) }

  static near(node, pos) { return Pos.after(node, pos) || Pos.before(node, pos) }
}

function findLeft(node, path) {
  if (node.type.block)
    return new Pos(path, 0)
  for (let i = 0; i < node.content.length; i++) {
    path.push(i)
    let found = findLeft(node.content[i], path)
    if (found) return found
    path.pop()
  }
}

function findAfter(node, pos, path) {
  if (node.type.block)
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

function findRight(node, path) {
  if (node.type.block)
    return new Pos(path, node.size)
  for (let i = node.content.length - 1; i >= 0; i--) {
    path.push(i)
    let found = findRight(node.content[i], path)
    if (found) return found
    path.pop()
  }
}

function findBefore(node, pos, path) {
  if (node.type.block) return pos
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
