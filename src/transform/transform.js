import {Pos} from "../model"

export class Chunk {
  constructor(start, size) {
    this.start = start
    this.size = size
  }
}

export class MovedChunk extends Chunk {
  constructor(start, size, dest) {
    super(start, size)
    this.dest = dest
  }
}

export class Collapsed {
  constructor(from, to, ref) {
    this.from = from
    this.to = to
    this.ref = ref
    this.chunks = []
  }
  chunk(start, size) {
    this.chunks.push(new Chunk(start, size))
  }
}

function findInChunks(pos, chunks, back) {
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i], start = back ? chunk.dest : chunk.start
    if (pos.cmp(start) >= 0 &&
        Pos.cmp(pos.path, pos.offset, start.path, start.offset + chunk.size) <= 0)
      return i
  }
}

export class Result {
  constructor(before, after) {
    this.before = before
    this.doc = after
    this.chunks = []
    this.inserted = null
    this.deleted = null
  }

  chunk(before, size, after) {
    if (before.cmp(after))
      this.chunks.push(new MovedChunk(before, size, after))
  }

  mapDir(pos, back, offset) {
    let deleted = (back ? this.inserted : this.deleted)
    let inserted = (back ? this.deleted : this.inserted)

    if (offset && offset.chunkID != null && inserted)
      return inserted.chunks[offset.chunkID].start.extend(offset.offset)

    if (deleted) {
      let front = pos.cmp(deleted.from), back = pos.cmp(deleted.to)
      if (front >= 0 && back <= 0) {
        if (offset) {
          let found = findInChunks(pos, deleted.chunks, false)
          if (found == null) throw new Error("Deleted chunks don't cover deleted area")
          offset({chunkID: found,
                  offset: pos.baseOn(deleted.chunks[found].start),
                  inside: !!(front && back)})
        }
        return deleted.ref
      }
    }

    let found = findInChunks(pos, this.chunks, back)
    if (found == null) return pos

    let chunk = this.chunks[found]
    let start = back ? chunk.dest : chunk.start, dest = back ? chunk.start : chunk.dest
    let depth = start.path.length
    if (pos.path.length > depth) {
      let offset = dest.offset + (pos.path[depth] - start.offset)
      return new Pos(dest.path.concat(offset).concat(pos.path.slice(depth + 1)), pos.offset)
    } else {
      return new Pos(dest.path, dest.offset + (pos.offset - start.offset))
    }
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
