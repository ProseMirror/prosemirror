import {Pos} from "../model"

export class Chunk {
  constructor(start, size, newStart) {
    this.start = start
    this.size = size
    this.newStart = newStart
  }
}

export class Result {
  constructor(before, after, untouched = null) {
    this.before = before
    this.doc = after
    this.untouched = untouched
    this.chunks = []
  }

  chunk(start, size, newStart) {
    this.chunks.push(new Chunk(start, size, newStart))
  }

  chunkDeleted(start, size) {
    this.chunks.push(new Chunk(start, size, null))
  }

  chunkAdded(start, size) {
    this.chunks.push(new Chunk(null, size, start))
  }

  map(pos) {
    if (this.untouched == null || pos.cmp(this.untouched) < 0)
      return pos

    for (let i = 0; i < this.chunks.length; i++) {
      let chunk = this.chunks[i]
      if (!chunk.newStart) continue // FIXME look at deleted chunks
      if (Pos.cmp(pos.path, pos.offset,
                  chunk.start.path, chunk.start.offset + chunk.size) <= 0) {
        let depth = chunk.start.path.length
        if (pos.cmp(chunk.start) < 0) {
          return Pos.after(this.doc, chunk.newStart)
        } else if (pos.path.length > depth) {
          let offset = chunk.newStart.offset + (pos.path[depth] - chunk.start.offset)
          return new Pos(chunk.newStart.path.concat(offset).concat(pos.path.slice(depth + 1)), pos.offset)
        } else {
          return new Pos(chunk.newStart.path, chunk.newStart.offset + (pos.offset - chunk.start.offset))
        }
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
