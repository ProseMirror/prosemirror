import {Pos} from "../model"

export class Result {
  constructor(before, after, untouched = null) {
    this.before = before
    this.doc = after
    this.untouched = untouched
    this.chunks = []
  }

  chunk(start, end, newStart) {
    this.chunks.push({start: start, end: end, newStart: newStart})
  }

  map(pos) {
    if (this.untouched == null || pos.cmp(this.untouched) < 0)
      return pos

    for (let i = 0; i < this.chunks.length; i++) {
      let chunk = this.chunks[i]
      if (pos.cmp(chunk.end) <= 0) {
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
