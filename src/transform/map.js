// ;; #path=Mappable #kind=interface
// There are various things that positions can be mapped through.
// We'll denote those as 'mappable'. This is not an actual class in
// the codebase, only an agreed-on interface.

// :: (pos: number, bias: ?number) → MapResult
// #path=Mappable.map
// Map a position through this object. When given, the `bias`
// determines in which direction to move when a chunk of content is
// inserted at or around the mapped position.

export class ReplacedRange {
  constructor(pos, oldSize, newSize) {
    this.pos = pos
    this.oldSize = oldSize
    this.newSize = newSize
  }

  size(old) { return old ? this.oldSize : this.newSize }

  toString() {
    return "[@" + this.pos + " " + this.oldSize + "->" + this.newSize + "]"
  }
}

function mapThrough(ranges, pos, bias = 1, back) {
  let diff = 0
  for (let i = 0; i < ranges.length; i++) {
    let range = ranges[i], rangePos = range.pos - (back ? diff : 0)
    if (rangePos > pos) break
    let oldSize = range.size(!back), newSize = range.size(back)
    if (pos == rangePos) {
      if (bias > 0 && oldSize == 0)
        return new MapResult(rangePos + newSize + diff)
      break
    }
    let end = rangePos + oldSize
    if (pos < end)
      return new MapResult(rangePos + (bias < 0 ? 0 : newSize) + diff, {index: i, offset: pos - rangePos})
    if (pos == end && bias < 0 && oldSize == 0)
      return new MapResult(rangePos + diff)
    diff += newSize - oldSize
  }
  return new MapResult(pos + diff)
}

// ;; The return value of mapping a position.
export class MapResult {
  constructor(pos, deleted = null) {
    // :: number The mapped version of the position.
    this.pos = pos
    // :: ?Object Tells you whether the position was deleted, that is,
    // whether the step removed its surroundings from the document.
    this.deleted = deleted
  }
}

// ;; A position map, holding information about the way positions in
// the pre-step version of a document correspond to positions in the
// post-step version. This class implements `Mappable`.
export class PosMap {
  constructor(ranges) { this.ranges = ranges }

  recover(offset) {
    return this.ranges[offset.index].pos + offset.offset
  }

  // :: (number, ?number) → MapResult
  // Map the given position through this map. The `bias` parameter can
  // be used to control what happens when the transform inserted
  // content at (or around) this position—if `bias` is negative, the a
  // position before the inserted content will be returned, if it is
  // positive, a position after the insertion is returned.
  map(pos, bias) {
    return mapThrough(this.ranges, pos, bias, false)
  }

  // :: () → PosMap
  // Create an inverted version of this map. The result can be used to
  // map positions in the post-step document to the pre-step document.
  invert() { return new InvertedPosMap(this.ranges) }

  toString() { return this.ranges.join(" ") }
}

class InvertedPosMap {
  constructor(ranges) { this.ranges = ranges }

  recover(offset) {
    let diff = 0
    for (let i = 0; i < offset.index; i++)
      diff += this.ranges[i].newSize - this.ranges[i].oldSize
    return this.ranges[offset.index].pos + diff + offset.offset
  }

  map(pos, bias) { return mapThrough(this.ranges, pos, bias, true) }

  invert() { return new PosMap(this.ranges) }

  toString() { return "-" + this.ranges.join(" ") }
}

PosMap.empty = new PosMap([])

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

  // :: (number, ?number) → MapResult
  // Map a position through this remapping, optionally passing a bias
  // direction.
  map(pos, bias) {
    let deleted = null

    for (let i = -this.head.length; i < this.tail.length; i++) {
      let map = this.get(i)
      let result = map.map(pos, bias)
      if (result.deleted) {
        let corr = this.mirror[i]
        if (corr != null) {
          i = corr
          pos = this.get(corr).recover(result.deleted)
          continue
        }
        deleted = true
      }
      pos = result.pos
    }

    return new MapResult(pos, deleted)
  }
}
