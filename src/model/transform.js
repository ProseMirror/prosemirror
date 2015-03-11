import Pos from "./pos"

export default class Transform {
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

Transform.identity = function(doc) {
  return new Transform(doc, doc, null)
};
