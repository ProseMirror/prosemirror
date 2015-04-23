import {Pos} from "../model"

export class MovedRange {
  constructor(start, size, dest = null) {
    this.start = start
    this.size = size
    this.dest = dest
  }

  get end() {
    return new Pos(this.start.path, this.start.offset + this.size)
  }
}

class Side {
  constructor(from, to, ref) {
    this.from = from
    this.to = to
    this.ref = ref
  }
}

export class ReplacedRange {
  constructor(from, to, newFrom, newTo, ref = from, newRef = newFrom) {
    this.before = new Side(from, to, ref)
    this.after = new Side(newFrom, newTo, newRef)
  }
}

const empty = []
const nullOffset = new Pos(empty, 0)

export class MapResult {
  constructor(pos, offset = null, deleted = false) {
    this.pos = pos
    this.offset = offset
    this.deleted = deleted
  }
}

function offsetFrom(base, pos) {
  if (pos.path.length > base.path.length) {
    let path = [pos.path[base.path.length] - base.offset]
    for (let i = base.path.length + 1; i < pos.path.length; i++)
      path.push(pos.path[i])
    return new Pos(path, pos.offset)
  } else {
    return new Pos([], pos.offset - base.offset)
  }
}

export class PosMap {
  constructor(moved, replaced) {
    this.moved = moved || empty
    this.replaced = replaced || empty
  }

  map(pos, bias = 0, back = false, offset = null) {
    if (!bias) bias = back ? -1 : 1

    let repl = this.replaced
    if (offset)
      return new MapResult(repl[offset.rangeID][back ? "before" : "after"].ref.extend(offset.offset))

    for (let i = 0; i < repl.length; i++) {
      let range = repl[i], side = back ? range.after : range.before
      let left, right
      if ((left = pos.cmp(side.from)) >= 0 &&
          (right = pos.cmp(side.to)) <= 0) {
        let other = back ? range.before : range.after
        return new MapResult(bias < 0 ? other.from : other.to,
                             {rangeID: i, offset: offsetFrom(side.ref, pos)},
                             !!(left && right))
      }
    }

    for (let i = 0; i < this.moved.length; i++) {
      let range = this.moved[i]
      let start = back ? range.dest : range.start
      if (pos.cmp(start) >= 0 &&
          Pos.cmp(pos.path, pos.offset, start.path, start.offset + range.size) <= 0) {
        let dest = back ? range.start : range.dest
        let depth = start.path.length, outPos
        if (pos.path.length > depth) {
          let offset = dest.offset + (pos.path[depth] - start.offset)
          return new MapResult(new Pos(dest.path.concat(offset).concat(pos.path.slice(depth + 1)), pos.offset))
        } else {
          return new MapResult(new Pos(dest.path, dest.offset + (pos.offset - start.offset)))
        }
      }
    }

    return new MapResult(pos)
  }

  mapSimple(pos, bias = 0, back = false) {
    return this.map(pos, bias, back, null).pos
  }
}

export function mapThrough(maps, pos, bias = 0, back = false, offsets = null) {
  let storeOffsets = offsets === true && []
  let hasOffsets = !storeOffsets && offsets
  let deleted = false
  for (let i = back ? maps.length - 1 : 0;
       back ? i >= 0 : i < maps.length;
       back ? i-- : i++) {
    let mapped = maps[i].map(pos, bias, back, hasOffsets && hasOffsets[i])
    if (mapped.deleted) deleted = true
    if (storeOffsets) storeOffsets[i] = mapped.offset
    pos = mapped.pos
  }
  return new MapResult(pos, storeOffsets, deleted)
}

export const nullMap = new PosMap
