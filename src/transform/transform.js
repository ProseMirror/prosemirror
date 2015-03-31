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

  map(pos) {
    if (this.untouched == null || pos.cmp(this.untouched) < 0)
      return pos

    for (let i = 0; i < this.chunks.length; i++) {
      let chunk = this.chunks[i]
      if (chunk.sizeBefore == 0 && chunk.sizeAfter > 0) continue
      if (pos.cmp(chunk.before) >= 0) {
        if (Pos.cmp(pos.path, pos.offset, chunk.before.path, chunk.before.offset + chunk.sizeBefore) <= 0) {
          let depth = chunk.before.path.length
          if (chunk.sizeAfter == 0) {
            return Pos.after(this.doc, chunk.after)
          } else if (pos.path.length > depth) {
            let offset = chunk.after.offset + (pos.path[depth] - chunk.before.offset)
            return new Pos(chunk.after.path.concat(offset).concat(pos.path.slice(depth + 1)), pos.offset)
          } else {
            return new Pos(chunk.after.path, chunk.after.offset + (pos.offset - chunk.before.offset))
          }
        }
      } else {
        break
      }
    }
    return pos
  }
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
