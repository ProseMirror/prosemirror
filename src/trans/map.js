import {Pos} from "../model"

export class MovedRange {
  constructor(start, size, dest = null, after = null) {
    this.start = start
    this.size = size
    this.dest = dest
  }

  get end() {
    return new Pos(this.start.path, this.start.offset + this.size)
  }
}

function isBelow(base, pos) {
  if (pos.path.length < base.path.length) return false
  for (let i = 0; i < base.path.length; i++)
    if (base.path[i] != pos.path[i]) return false
  return true
}

export class CollapsedRange {
  constructor(from, to, refLeft, refRight = refLeft) {
    this.from = from
    this.to = to
    this.refLeft = refLeft
    this.refRight = refRight
  }

  getOffset(pos) {
    let base = this.from, side = -1
    if (!isBelow(base, pos)) {
      if (isBelow(this.to, pos)) {
        ;[base, side] = [this.to, 1]
      } else {
        // We assume this is a join (or inverted split) producing a
        // deleted range around a single 'gap', since that is, unless
        // something broke, the only transform that generates deleted
        // ranges without at least one side below all its content.
        // Return a special marker value. Other cases are not handled.
        if (pos.offset != base.path[pos.path.length] + 1 ||
            pos.path.length != base.path.length - 1)
          throw new Error("Unsupported base/pos relation between " + pos + " and " + base)
        return {side: 0, pos: null}
      }
    }

    if (pos.path.length > base.path.length) {
      let path = [pos.path[base.path.length] - base.offset]
      for (let i = base.path.length + 1; i < pos.path.length; i++)
        path.push(pos.path[i])
      return {side, pos: new Pos(path, pos.offset)}
    } else {
      return {side, pos: new Pos([], pos.offset - base.offset)}
    }
  }

  fromOffset(offset) {
    if (offset.side == 0)
      return this.from.shorten(null, 1)
    else
      return (offset.side < 0 ? this.from : this.to).extend(offset.pos)
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

export class PosMap {
  constructor(moved, deleted, inserted) {
    this.moved = moved || empty
    this.deleted = deleted || empty
    this.inserted = inserted || empty
  }

  map(pos, bias = 0, back = false, offset = null) {
    if (!bias) bias = back ? -1 : 1
    let inserted = back ? this.deleted : this.inserted
    if (offset)
      return new MapResult(inserted[offset.rangeID].fromOffset(offset.offset))

    let deleted = (back ? this.inserted : this.deleted)
    for (let i = 0; i < deleted.length; i++) {
      let range = deleted[i], front, back
      if ((front = pos.cmp(range.from)) >= 0 &&
          (back = pos.cmp(range.to)) <= 0)
        return new MapResult(bias < 0 ? range.refLeft : range.refRight,
                             {rangeID: i, offset: range.getOffset(pos)},
                             !!(front || back))
    }

    for (let i = 0; i < inserted.length; i++) {
      let range = inserted[i]
      if (pos.cmp(range.refLeft) == 0 ||
          (range.refLeft != range.refRight && pos.cmp(range.refRight) == 0))
        return new MapResult(bias < 0 ? range.from : range.to)
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

export const nullMap = new PosMap
