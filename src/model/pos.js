import {ModelError} from "./error"

// ;; Instances of the `Pos` class represent positions in a document.
// A position is an array of integers that describe a path to the target
// node (see `Node.path`) and an integer offset into that target node.

export class Pos {
  // :: (path: [number], number)
  constructor(path, offset) {
    // :: [number] The path to the target node.
    this.path = path
    // :: number The offset into the target node.
    this.offset = offset
  }

  // ;; Return a string representation of the path of the form
  // `"0/2:10"`, where the numbers before the colon are the path, and
  // the number after it is the offset.
  toString() {
    return this.path.join("/") + ":" + this.offset
  }

  // :: number
  // The length of the position's path.
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

  // :: (Pos) → Pos
  // Return the greater of two positions.
  max(other) { return this.cmp(other) > 0 ? this : other }

  // :: (Pos) → Pos
  // Return the lesser of two positions.
  min(other) { return this.cmp(other) < 0 ? this : other }

  // :: ([number], [number]) → bool
  // Compares two paths and returns true when they are the same.
  static samePath(pathA, pathB) {
    if (pathA.length != pathB.length) return false
    for (let i = 0; i < pathA.length; i++) if (pathA[i] !== pathB[i]) return false
    return true
  }

  // :: (Pos) → number
  // Compares this position to another position, and returns a number.
  // Of this result number, only the sign is significant. It is
  // negative if this position is less than the other one, zero if
  // they are the same, and positive if this position is greater.
  cmp(other) {
    if (other == this) return 0
    return Pos.cmp(this.path, this.offset, other.path, other.offset)
  }

  static shorten(path, to = null, offset = 0) {
    if (to == null) to = path.length - 1
    return new Pos(path.slice(0, to), path[to] + offset)
  }

  // :: (?number, ?number) → Pos
  // Create a position pointing into a parent of this position's
  // target. When `to` is given, it determines the new length of the
  // path. By default, the path becomes one shorter. The `offset`
  // parameter can be used to determine where in this parent the
  // position points. By default, it points before the old target. You
  // can pass a negative or positive integer to move it backward or
  // forward (**note**: this method performs no bounds checking).
  shorten(to = null, offset = 0) {
    if (to >= this.depth) return this
    return Pos.shorten(this.path, to, offset)
  }

  // :: (number) → Pos
  // Create a position with an offset moved relative to this
  // position's offset. For example moving `0/1:10` by `-2` yields
  // `0/1:8`.
  move(by) {
    return new Pos(this.path, this.offset + by)
  }

  // :: (?number) → [number]
  // Convert this position to an array of numbers (including its
  // offset). Optionally pass an argument to adjust the value of the
  // offset.
  toPath(move = 0) {
    return this.path.concat(this.offset + move)
  }

  extend(pos) {
    let path = this.path.slice(), add = this.offset
    for (let i = 0; i < pos.path.length; i++) {
      path.push(pos.path[i] + add)
      add = 0
    }
    return new Pos(path, pos.offset + add)
  }

  // :: (Node, ?bool) → bool
  // Checks whether this position is valid in the given document. When
  // `requireTextblock` is true, only positions inside textblocks are
  // considered valid.
  isValid(doc, requireTextblock) {
    for (let i = 0, node = doc;; i++) {
      if (i == this.path.length) {
        if (requireTextblock && !node.isTextblock) return false
        return this.offset <= node.size
      } else {
        let n = this.path[i]
        if (n >= node.size) return false
        node = node.child(n)
      }
    }
  }

  // :: () → Object
  // Convert the position to a JSON-safe representation.
  toJSON() { return this }

  // :: ([number], ?number) → Pos
  // Build a position from an array of numbers (as in
  // [`toPath`](#Pos.toPath)), taking the last element of the array as
  // offset and optionally moving it by `move`.
  static from(array, move = 0) {
    if (!array.length) ModelError.raise("Can't create a pos from an empty array")
    return new Pos(array.slice(0, array.length - 1), array[array.length - 1] + move)
  }

  // :: (Object) → Pos
  // Create a position from a JSON representation.
  static fromJSON(json) { return new Pos(json.path, json.offset) }
}
