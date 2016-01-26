import {Pos} from "../model"

// ;; #kind=interface #path=Mappable
// There are various things that positions can be mapped through.
// We'll denote those as 'mappable'. This is not an actual class in
// the codebase, only an agreed-on interface.

// :: (pos: Pos, bias: ?number) → MapResult
// #path=Mappable.map
// Map a position through this object. When given, the `bias`
// determines in which direction to move when a chunk of content is
// inserted at or around the mapped position.

export class MovedRange {
  constructor(start, size, dest = null) {
    this.start = start
    this.size = size
    this.dest = dest
  }

  get end() {
    return new Pos(this.start.path, this.start.offset + this.size)
  }

  toString() {
    return "[moved " + this.start + "+" + this.size + " to " + this.dest + "]"
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

  toString() {
    return "[replaced " + this.before.from + "-" + this.before.to + " with " + this.after.from + "-" + this.after.to + "]"
  }
}

const empty = []

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

function mapThrough(map, pos, bias = 1, back) {
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

// ;; A position map, holding information about the way positions in
// the pre-step version of a document correspond to positions in the
// post-step version. This class implements `Mappable`.
export class PosMap {
  constructor(moved, replaced) {
    this.moved = moved || empty
    this.replaced = replaced || empty
  }

  recover(offset) {
    return this.replaced[offset.rangeID].after.ref.extend(offset.offset)
  }

  // :: (Pos, ?number) → MapResult
  // Map the given position through this map. The `bias` parameter can
  // be used to control what happens when the transform inserted
  // content at (or around) this position—if `bias` is negative, the a
  // position before the inserted content will be returned, if it is
  // positive, a position after the insertion is returned.
  map(pos, bias) {
    return mapThrough(this, pos, bias, false)
  }

  // :: () → PosMap
  // Create an inverted version of this map. The result can be used to
  // map positions in the post-step document to the pre-step document.
  invert() { return new InvertedPosMap(this) }

  toString() { return this.moved.concat(this.replaced).join(" ") }
}

// ;; The return value of mapping a position.
export class MapResult {
  constructor(pos, deleted = false, recover = null) {
    // :: Pos The mapped version of the position.
    this.pos = pos
    // :: bool Tells you whether the position was deleted, that is,
    // whether the step removed its surroundings from the document.
    this.deleted = deleted
    this.recover = recover
  }
}

class InvertedPosMap {
  constructor(map) { this.inner = map }

  recover(offset) {
    return this.inner.replaced[offset.rangeID].before.ref.extend(offset.offset)
  }

  map(pos, bias) {
    return mapThrough(this.inner, pos, bias, true)
  }

  invert() { return this.inner }

  toString() { return "-" + this.inner }
}

export const nullMap = new PosMap

// ;; A remapping represents a pipeline of zero or more mappings. It
// is a specialized data structured used to manage mapping through a
// series of steps, typically including inverted and non-inverted
// versions of the same step. (This comes up when ‘rebasing’ steps for
// collaboration or history management.) This class implements
// `Mappable`.
export class Remapping {
  // :: (?[PosMap], ?[PosMap])
  constructor(head = [], tail = [], mirror = Object.create(null)) {
    // :: [PosMap]
    // The maps in the head of the mapping are applied to input
    // positions first, back-to-front. So the map at the end of this
    // array (if any) is the very first one applied.
    this.head = head
    // The maps in the tail are applied last, front-to-back.
    this.tail = tail
    this.mirror = mirror
  }

  // :: (PosMap, ?number) → number
  // Add a map to the mapping's front. If this map is the mirror image
  // (produced by an inverted step) of another map in this mapping,
  // that map's id (as returned by this method or
  // [`addToBack`](#Remapping.addToBack)) should be passed as a second
  // parameter to register the correspondence.
  addToFront(map, corr) {
    this.head.push(map)
    let id = -this.head.length
    if (corr != null) this.mirror[id] = corr
    return id
  }

  // :: (PosMap, ?number) → number
  // Add a map to the mapping's back. If the map is the mirror image
  // of another mapping in this object, the id of that map should be
  // passed to register the correspondence.
  addToBack(map, corr) {
    this.tail.push(map)
    let id = this.tail.length - 1
    if (corr != null) this.mirror[corr] = id
    return id
  }

  get(id) {
    return id < 0 ? this.head[-id - 1] : this.tail[id]
  }

  // :: (Pos, ?number) → MapResult
  // Map a position through this remapping, optionally passing a bias
  // direction.
  map(pos, bias) {
    let deleted = false

    for (let i = -this.head.length; i < this.tail.length; i++) {
      let _map = this.get(i)
      let result = _map.map(pos, bias)
      if (result.recover) {
        let corr = this.mirror[i]
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
