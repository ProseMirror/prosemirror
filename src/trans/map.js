export class Chunk {
  constructor(start, size, dest, inclusive) {
    this.start = start
    this.size = size
    this.dest = dest
    this.inclusive = inclusive
  }
}

export class PosMap {
  constructor() {
    this.moved = []
    this.deleted = []
    this.inserted = []
  }

  map(pos, offset) {
    // FIXME
  }
}

export const nullMap = new PosMap;
