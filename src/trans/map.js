export class Chunk {
  constructor(start, size, dest, inclusive) {
    this.start = start
    this.size = size
    this.dest = dest
    this.inclusive = inclusive
  }
}

const empty = []

export class PosMap {
  constructor(moved, deleted, inserted) {
    this.moved = moved || empty
    this.deleted = deleted || empty
    this.inserted = inserted || empty
  }

  map(pos, offset) {
    // FIXME
  }
}

export const nullMap = new PosMap;
