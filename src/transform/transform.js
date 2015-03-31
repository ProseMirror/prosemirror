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
}

export class Result {
  constructor(before, after, untouched = null) {
    this.before = before
    this.doc = after
    this.untouched = untouched
    this.chunks = []
  }

  chunk(before, sizeBefore, after, sizeAfter=sizeBefore) {
    if (before.cmp(after) || sizeBefore != sizeAfter)
      this.chunks.push(new Chunk(before, sizeBefore, after, sizeAfter))
  }

  mapDir(pos, back) {
    if (this.untouched == null || pos.cmp(this.untouched) < 0)
      return pos

    for (let i = 0; i < this.chunks.length; i++) {
      let sizeBefore, sizeAfter, before, after
      if (back) {
        ({sizeBefore: sizeAfter, sizeAfter: sizeBefore, before: after, after: before}) = this.chunks[i]
      } else {
        ({sizeBefore, sizeAfter, before, after}) = this.chunks[i]
      }

      if (sizeBefore == 0 && sizeAfter > 0) continue
      if (pos.cmp(before) >= 0) {
        if (Pos.cmp(pos.path, pos.offset, before.path, before.offset + sizeBefore) <= 0) {
          let depth = before.path.length
          if (sizeBefore > 0 && sizeAfter == 0) {
            let pos = Pos.after(this.doc, after) || Pos.before(this.doc, after)
            return pos
          } else if (pos.path.length > depth) {
            let offset = after.offset + (pos.path[depth] - before.offset)
            return new Pos(after.path.concat(offset).concat(pos.path.slice(depth + 1)), pos.offset)
          } else {
            return new Pos(after.path, after.offset + (pos.offset - before.offset))
          }
        }
      } else {
        break
      }
    }
    return pos
  }

  map(pos) { return this.mapDir(pos, false) }
  mapBack(pos) { return this.mapDir(pos, true) }
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
  return new Result(doc, result || doc, null)
}
