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

  cmp(other) {
    if (other == this) return 0
    return Pos.cmp(this.path, this.offset, other.path, other.offset)
  }

  static shorten(path, to = null, offset = 0) {
    if (to == null) to = path.length - 1
    return new Pos(path.slice(0, to), path[to] + offset)
  }

  shorten(to = null, offset = 0) {
    if (to >= this.depth) return this
    return Pos.shorten(this.path, to, offset)
  }

  move(by) {
    return new Pos(this.path, this.offset + by)
  }

  toPath(offset = 0) {
    return this.path.concat(this.offset + offset)
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

  static from(array, extraOffset = 0) {
    if (!array.length) throw new Error("Can't create a pos from an empty array")
    return new Pos(array.slice(0, array.length - 1), array[array.length - 1] + extraOffset)
  }

  static fromJSON(json) { return new Pos(json.path, json.offset) }
}
