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

export class CollapsedRange {
  constructor(from, to, refLeft, refRight = refLeft) {
    this.from = from
    this.to = to
    this.refLeft = refLeft
    this.refRight = refRight
  }

  get base() {
    return this.from.path.length <= this.to.path.length ? this.from : this.to
  }
}

const empty = []
const nullOffset = new Pos(empty, 0)

class MapResult {
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

  _map(pos, back = false, offset = null, bias = 1) {
    let inserted = back ? this.deleted : this.inserted
    if (offset)
      return new MapResult(inserted[offset.rangeID].base.extend(offset.offset))

    let deleted = (back ? this.inserted : this.deleted)
    for (let i = 0; i < deleted.length; i++) {
      let range = deleted[i], front, back
      if ((front = pos.cmp(range.from)) >= 0 &&
          (back = pos.cmp(range.to)) <= 0)
        return new MapResult(bias < 0 ? range.refLeft : range.refRight,
                             {rangeID: i, offset: pos.baseOn(range.base)},
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

  map(pos, bias = 1) {
    return this._map(pos, false, null, bias).pos
  }
}

export const nullMap = new PosMap
