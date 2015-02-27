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
    for (let i = 0, len = Math.min(len, oLen); i < len; i++) {
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
