import Pos from "./pos"

export class Result {
  constructor(before, after, untouched = null) {
    this.before = before
    this.doc = after
    this.untouched = untouched
    this.chunks = []
  }

  chunk(end, map) {
    this.chunks.push({end: end, map: map})
  }

  map(pos) {
    if (this.untouched == null || pos.cmp(this.untouched) < 0)
      return pos

    for (let i = 0; i < this.chunks.length; i++) {
      let chunk = this.chunks[i]
      if (pos.cmp(chunk.end) <= 0) return chunk.map(pos)
    }
    return pos
  }
}

const transforms = Object.create(null)

export function define(name, impl) {
  transforms[name] = impl
}

export function apply(doc, params) {
  let fn = transforms[params.name]
  if (!fn) throw new Error("Undefined transform " + params.name)
  return fn(doc, params)
}

export function identity(doc) {
  return new Result(doc, doc, null)
}

export function flat(doc, result) {
  return new Result(doc, result, null)
}
