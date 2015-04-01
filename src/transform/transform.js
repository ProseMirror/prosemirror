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

function isInChunk(pos, before, sizeBefore) {
  return pos.cmp(before) >= 0 &&
    Pos.cmp(pos.path, pos.offset, before.path, before.offset + sizeBefore) <= 0
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

  iterChunks(back, type, f) {
    for (let i = 0, off = 0; i < this.chunks.length; i++) {
      let sizeBefore, sizeAfter, before, after
      if (back) {
        ({sizeBefore: sizeAfter, sizeAfter: sizeBefore, before: after, after: before}) = this.chunks[i]
      } else {
        ({sizeBefore, sizeAfter, before, after}) = this.chunks[i]
      }

      if (type == (sizeBefore == sizeAfter ? "normal" : sizeBefore ? "deleted" : "inserted")) {
        let value = f(before, sizeBefore, after, sizeAfter, off++)
        if (value != null) return value
      }
    }
  }

  mapDir(pos, back, offset) {
    if (offset && offset.rangeID != null)
      return this.iterChunks(back, "inserted", (_before, _sizeBefore, after, _sizeAfter, i) => {
        if (i == offset.rangeID) return after.extend(offset.offset)
      })

    let normal = this.iterChunks(back, "normal", (before, sizeBefore, after) => {
      if (isInChunk(pos, before, sizeBefore)) {
        let depth = before.path.length
        if (pos.path.length > depth) {
          let offset = after.offset + (pos.path[depth] - before.offset)
          return new Pos(after.path.concat(offset).concat(pos.path.slice(depth + 1)), pos.offset)
        } else {
          return new Pos(after.path, after.offset + (pos.offset - before.offset))
        }
      }
    })
    if (normal) return normal

    let deleted = this.iterChunks(back, "deleted", (before, sizeBefore, after, _, i) => {
      if (isInChunk(pos, before, sizeBefore)) {
        if (offset) offset({rangeID: i, offset: pos.baseOn(before)})
        return Pos.after(this.doc, after) || Pos.before(this.doc, after)
      }
    })

    return deleted || pos
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
