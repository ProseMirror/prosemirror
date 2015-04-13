import {Pos} from "../model"

export class Range {
  constructor(start, size, dest = null, afterInsert = false) {
    this.start = start
    this.size = size
    this.dest = dest
    this.afterInsert = afterInsert
  }

  get end() {
    return new Pos(this.start.path, this.start.offset + this.size)
  }
}

export class SinglePos {
  constuctor(pos, before, after) {
    this.pos = pos
    this.before = before
    this.after = after
  }
}

const empty = []
const nullOffset = new Pos(empty, 0)

export class PosMap {
  constructor(moved, deleted, inserted) {
    this.moved = moved || empty
    this.deleted = deleted || empty
    this.inserted = inserted || empty
  }

  _map(pos, back = false, offset = null, bias = 1) {
    if (offset) {
      let start = (back ? this.deleted : this.inserted)[offset.chunkID]
      return {pos: (start instanceof Range ? start.start : start.pos).extend(offset.offset),
              offset: null,
              deleted: false}
    }

    let deleted = (back ? this.inserted : this.deleted)
    for (let i = 0; i < deleted.length; i++) {
      let chunk = deleted[i]
      if (chunk instanceof SinglePos) {
        if (pos.cmp(chunk.pos) == 0)
          return {pos: (bias < 0 && chunk.before) || chunk.after || chunk.before,
                  offset: {chunkID: i, offset: nullOffset},
                  deleted: true}
      } else {
        let front = pos.cmp(chunk.start)
        if (front < 0) continue
        let back = Pos.cmp(pos.path, pos.offset, chunk.start.path, chunk.start.offset + chunk.size)
        if (back > 0) continue
        return {pos: chunk.start,
                offset: {chunkID: i, offset: pos.baseOn(chunk.start)},
                deleted: !!(front || back)}
      }
    }

    for (let i = 0; i < this.moved.length; i++) {
      let chunk = this.moved[i]
      let start = back ? chunk.dest : chunk.start
      let cmp = pos.cmp(start)
      if ((chunk.afterInsert && bias < 0 ? cmp >= 0 : cmp >= 0) &&
          Pos.cmp(pos.path, pos.offset, start.path, start.offset + chunk.size) <= 0) {
        let dest = back ? chunk.start : chunk.dest
        let depth = start.path.length, outPos
        if (pos.path.length > depth) {
          let offset = dest.offset + (pos.path[depth] - start.offset)
          outPos = new Pos(dest.path.concat(offset).concat(pos.path.slice(depth + 1)), pos.offset)
        } else {
          outPos = new Pos(dest.path, dest.offset + (pos.offset - start.offset))
        }
        return {pos: outPos, offset: null, deleted: false}
      }
    }

    return {pos: pos, offset: null, deleted: false}
  }

  map(pos) {
    return this._map(pos, false, null, 1).pos
  }
}

export const nullMap = new PosMap
