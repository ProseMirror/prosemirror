import {Pos} from "../model"

export class Chunk {
  constructor(before, sizeBefore, after, sizeAfter) {
    this.before = before
    this.sizeBefore = sizeBefore
    this.after = after
    this.sizeAfter = sizeAfter
  }

  get endAfter() {
    return new Pos(this.after.path, this.after.offset + this.sizeAfter)
  }
  get endBefore() {
    return new Pos(this.before.path, this.before.offset + this.sizeBefore)
  }

  toString() {
    return this.before + "+" + this.sizeBefore + " -> " + this.after + "+" + this.sizeAfter
  }
}

export class Result {
  constructor(before, after) {
    this.before = before
    this.doc = after
    this.chunks = []
  }

  chunk(before, sizeBefore, after, sizeAfter=sizeBefore) {
    if (before.cmp(after) || sizeBefore != sizeAfter)
      this.chunks.push(new Chunk(before, sizeBefore, after, sizeAfter))
  }

  // FIXME This is too suble and messy. At some point, try to clean it up.
  mapDir(pos, back, offset) {
    let deletedID = 0, insertedID = 0
    let isRecover = offset && offset.rangeID != null

    for (let i = 0; i < this.chunks.length; i++) {
      let sizeBefore, sizeAfter, before, after
      if (back) {
        ({sizeBefore: sizeAfter, sizeAfter: sizeBefore, before: after, after: before}) = this.chunks[i]
      } else {
        ({sizeBefore, sizeAfter, before, after}) = this.chunks[i]
      }

      if (sizeBefore == 0 && sizeAfter > 0) { // Inserted chunk
        if (isRecover && insertedID == offset.rangeID)
          return after.extend(offset.offset)
        ++insertedID
        continue
      }

      let deleted = sizeBefore > 0 && sizeAfter == 0
      if (!isRecover && pos.cmp(before) >= 0) {
        if (Pos.cmp(pos.path, pos.offset, before.path, before.offset + sizeBefore) <= 0) {
          let depth = before.path.length
          if (deleted) {
            if (offset) offset({rangeID: deletedID, offset: pos.baseOn(before)})
            return Pos.after(this.doc, after) || Pos.before(this.doc, after)
          } else if (pos.path.length > depth) {
            let offset = after.offset + (pos.path[depth] - before.offset)
            return new Pos(after.path.concat(offset).concat(pos.path.slice(depth + 1)), pos.offset)
          } else {
            return new Pos(after.path, after.offset + (pos.offset - before.offset))
          }
        }
      } else if (!isRecover && !back) {
        break
      }
      if (deleted) ++deletedID
    }
    return pos
  }

  map(pos, offset = null) { return this.mapDir(pos, false, offset) }
  mapBack(pos, offset = null) { return this.mapDir(pos, true, offset) }
}

const transforms = Object.create(null)

export function defineTransform(name, impl) {
  transforms[name] = impl
}

export function applyTransform(doc, params) {
  let fn = transforms[params.name]
  if (!fn) throw new Error("Undefined transform " + params.name)
  return fn(doc, params)
}

export function flatTransform(doc, result) {
  return new Result(doc, result || doc)
}
