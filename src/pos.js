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

  leaf(doc) {
    for (var node = doc, i = 0; i < this.path.length; i++)
      node = node.content[this.path[i]]
    return node
  }
}

Pos.end = function(node, path = []) {
  if (node.type.contains == "inline")
    return new Pos(path, node.size)
  for (let i = node.content.length - 1; i >= 0; i--) {
    path.push(i)
    let found = Pos.end(node.content[i], path)
    if (found) return found
    path.pop(i)
  }
}

Pos.start = function(node, path = []) {
  if (node.type.contains == "inline")
    return new Pos(path, 0)
  for (let i = 0; i < node.content.length; i++) {
    path.push(i)
    let found = Pos.start(node.content[i], path)
    if (found) return found
    path.pop(i)
  }
}
