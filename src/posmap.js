import Pos from "./pos"

export default class PosMap {
  constructor(doc, untouched = null) {
    this.doc = doc
    this.untouched = untouched
    this.chunks = []
  }

  chunk(end, map) {
    this.chunks.push({end: end, map: map})
  }

  map(pos) {
    if (this.untouched && pos.cmp(this.untouched) < 0)
      return pos

    for (let i = 0;; i++) {
      let chunk = this.chunks[i]
      if (i == this.chunks.length - 1 || pos.cmp(chunk.end) <= 0)
        return chunk.map(pos)
    }
  }
}
