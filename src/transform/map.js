import {Pos} from "../model"

import {Step} from "./step"

export class MovedRange {
  constructor(start, size, dest = null) {
    this.start = start
    this.size = size
    this.dest = dest
  }

  get end() {
    return new Pos(this.start.path, this.start.offset + this.size)
  }
}

class Side {
  constructor(from, to, ref) {
    this.from = from
    this.to = to
    this.ref = ref
  }
}

export class ReplacedRange {
  constructor(from, to, newFrom, newTo, ref = from, newRef = newFrom) {
    this.before = new Side(from, to, ref)
    this.after = new Side(newFrom, newTo, newRef)
  }
}

const empty = []

export class MapResult {
  constructor(pos, deleted = false, recover = null) {
    this.pos = pos
    this.deleted = deleted
    this.recover = recover
  }
}

function offsetFrom(base, pos) {
  if (pos.path.length > base.path.length) {
    let path = [pos.path[base.path.length] - base.offset]
    for (let i = base.path.length + 1; i < pos.path.length; i++)
      path.push(pos.path[i])
    return new Pos(path, pos.offset)
  } else {
    return new Pos([], pos.offset - base.offset)
  }
}

function mapThrough(map, pos, bias, back) {
  if (!bias) bias = back ? -1 : 1

  for (let i = 0; i < map.replaced.length; i++) {
    let range = map.replaced[i], side = back ? range.after : range.before
    let left, right
    if ((left = pos.cmp(side.from)) >= 0 &&
        (right = pos.cmp(side.to)) <= 0) {
      let other = back ? range.before : range.after
      return new MapResult(bias < 0 ? other.from : other.to,
                           !!(left && right),
                           {rangeID: i, offset: offsetFrom(side.ref, pos)})
    }
  }

  for (let i = 0; i < map.moved.length; i++) {
    let range = map.moved[i]
    let start = back ? range.dest : range.start
    if (pos.cmp(start) >= 0 &&
        Pos.cmp(pos.path, pos.offset, start.path, start.offset + range.size) <= 0) {
      let dest = back ? range.start : range.dest
      let depth = start.depth
      if (pos.depth > depth) {
        let offset = dest.offset + (pos.path[depth] - start.offset)
        return new MapResult(new Pos(dest.path.concat(offset).concat(pos.path.slice(depth + 1)), pos.offset))
      } else {
        return new MapResult(new Pos(dest.path, dest.offset + (pos.offset - start.offset)))
      }
    }
  }

  return new MapResult(pos)
}

export class PosMap {
  constructor(moved, replaced) {
    this.moved = moved || empty
    this.replaced = replaced || empty
  }

  recover(offset) {
    return this.replaced[offset.rangeID].after.ref.extend(offset.offset)
  }

  map(pos, bias = 0) {
    return mapThrough(this, pos, bias, false)
  }

  invert() { return new InvertedPosMap(this) }
}

class InvertedPosMap {
  constructor(map) { this.inner = map }

  recover(offset) {
    return this.map.replaced[offset.rangeID].before.ref.extend(offset.offset)
  }

  map(pos, bias = 0) {
    return mapThrough(this.inner, pos, -bias, true)
  }

  invert() { return this.inner }
}

export const nullMap = new PosMap

export class Remapping {
  constructor(head = [], tail = [], corresponds = Object.create(null)) {
    this.head = head
    this.tail = tail
    this.corresponds = corresponds
  }

  addToFront(map, corr) {
    this.head.push(map)
    let id = -this.head.length
    if (corr != null) this.corresponds[id] = corr
    return id
  }

  addToBack(map, corr) {
    this.tail.push(map)
    let id = this.tail.length - 1
    if (corr != null) this.corresponds[corr] = id
    return id
  }

  get(id) {
    return id < 0 ? this.head[-id - 1] : this.tail[id]
  }

  map(pos, bias) {
    let deleted = false

    for (let i = -this.head.length; i < this.tail.length; i++) {
      let map = this.get(i)
      let result = map.map(pos, bias)
      if (result.recover) {
        let corr = this.corresponds[i]
        if (corr != null) {
          i = corr
          pos = this.get(corr).recover(result.recover)
          continue
        }
      }
      if (result.deleted) deleted = true
      pos = result.pos
    }

    return new MapResult(pos, deleted)
  }
}

function maxPos(a, b) {
  return a.cmp(b) > 0 ? a : b
}

export function mapStep(step, remapping) {
  let allDeleted = true
  let from = null, to = null, pos = null

  if (step.from) {
    let result = remapping.map(step.from, 1)
    from = result.pos
    if (!result.deleted) allDeleted = false
  }
  if (step.to) {
    if (step.to.cmp(step.from) == 0) {
      to = from
    } else {
      let result = remapping.map(step.to, -1)
      to = maxPos(result.pos, from)
      if (!result.deleted) allDeleted = false
    }
  }
  if (step.pos) {
    if (from && step.pos.cmp(step.from) == 0) {
      pos = from
    } else if (to && step.pos.cmp(step.to) == 0) {
      pos = to
    } else {
      let result = remapping.map(step.pos, 1)
      pos = result.pos
      if (!result.deleted) allDeleted = false
    }
  }
  if (!allDeleted) return new Step(step.name, from, to, pos, step.param)
}
