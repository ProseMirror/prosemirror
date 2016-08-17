// ;; #path=Mappable #kind=interface
// There are various things that positions can be mapped through.
// We'll denote those as 'mappable'. This is not an actual class in
// the codebase, only an agreed-on interface.

// :: (pos: number, bias: ?number) → number #path=Mappable.map
// Map a position through this object. When given, `bias` (should be
// -1 or 1) determines in which direction to move when a chunk of
// content is inserted at or around the mapped position.

// :: (pos: number, bias: ?number) → MapResult #path=Mappable.mapResult
// Map a position, and return an object containing additional
// information about the mapping. The result's `deleted` field tells
// you whether the position was deleted (completely enclosed in a
// replaced range) during the mapping.

// Recovery values encode a range index and an offset. They are
// represented as numbers, because tons of them will be created when
// mapping, for example, a large number of marked ranges. The number's
// lower 16 bits provide the index, the remaining bits the offset.
//
// Note: We intentionally don't use bit shift operators to en- and
// decode these, since those clip to 32 bits, which we might in rare
// cases want to overflow. A 64-bit float can represent 48-bit
// integers precisely.

const lower16 = 0xffff
const factor16 = Math.pow(2, 16)

function makeRecover(index, offset) { return index + offset * factor16 }
function recoverIndex(value) { return value & lower16 }
function recoverOffset(value) { return (value - (value & lower16)) / factor16 }

// ;; An object representing a mapped position with some extra
// information.
class MapResult {
  constructor(pos, deleted = false, recover = null) {
    // :: number The mapped version of the position.
    this.pos = pos
    // :: bool Tells you whether the position was deleted, that is,
    // whether the step removed its surroundings from the document.
    this.deleted = deleted
    this.recover = recover
  }
}
exports.MapResult = MapResult

// ;; A position map, holding information about the way positions in
// the pre-step version of a document correspond to positions in the
// post-step version. This class implements `Mappable`.
class PosMap {
  // :: ([number])
  // Create a position map. The modifications to the document are
  // represented as an array of numbers, in which each group of three
  // represents a modified chunk as `[start, oldSize, newSize]`.
  constructor(ranges, inverted = false) {
    this.ranges = ranges
    this.inverted = inverted
  }

  recover(value) {
    let diff = 0, index = recoverIndex(value)
    if (!this.inverted) for (let i = 0; i < index; i++)
      diff += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1]
    return this.ranges[index * 3] + diff + recoverOffset(value)
  }

  // :: (number, ?number) → MapResult
  // Map the given position through this map. The `bias` parameter can
  // be used to control what happens when the transform inserted
  // content at (or around) this position—if `bias` is negative, the a
  // position before the inserted content will be returned, if it is
  // positive, a position after the insertion is returned.
  mapResult(pos, bias) { return this._map(pos, bias, false) }

  // :: (number, ?number) → number
  // Map the given position through this map, returning only the
  // mapped position.
  map(pos, bias) { return this._map(pos, bias, true) }

  _map(pos, bias, simple) {
    let diff = 0, oldIndex = this.inverted ? 2 : 1, newIndex = this.inverted ? 1 : 2
    for (let i = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i] - (this.inverted ? diff : 0)
      if (start > pos) break
      let oldSize = this.ranges[i + oldIndex], newSize = this.ranges[i + newIndex], end = start + oldSize
      if (pos <= end) {
        let side = !oldSize ? bias : pos == start ? -1 : pos == end ? 1 : bias
        let result = start + diff + (side < 0 ? 0 : newSize)
        if (simple) return result
        let recover = makeRecover(i / 3, pos - start)
        return new MapResult(result, pos != start && pos != end, recover)
      }
      diff += newSize - oldSize
    }
    return simple ? pos + diff : new MapResult(pos + diff)
  }

  touches(pos, recover) {
    let diff = 0, index = recoverIndex(recover)
    let oldIndex = this.inverted ? 2 : 1, newIndex = this.inverted ? 1 : 2
    for (let i = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i] - (this.inverted ? diff : 0)
      if (start > pos) break
      let oldSize = this.ranges[i + oldIndex], end = start + oldSize
      if (pos <= end && i == index * 3) return true
      diff += this.ranges[i + newIndex] - oldSize
    }
    return false
  }

  // :: ((oldStart: number, oldEnd: number, newStart: number, newEnd: number))
  // Calls the given function on each of the changed ranges denoted by
  // this map.
  forEach(f) {
    let oldIndex = this.inverted ? 2 : 1, newIndex = this.inverted ? 1 : 2
    for (let i = 0, diff = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i], oldStart = start - (this.inverted ? diff : 0), newStart = start + (this.inverted ? 0 : diff)
      let oldSize = this.ranges[i + oldIndex], newSize = this.ranges[i + newIndex]
      f(oldStart, oldStart + oldSize, newStart, newStart + newSize)
      diff += newSize - oldSize
    }
  }

  // :: () → PosMap
  // Create an inverted version of this map. The result can be used to
  // map positions in the post-step document to the pre-step document.
  invert() {
    return new PosMap(this.ranges, !this.inverted)
  }

  toString() {
    return (this.inverted ? "-" : "") + JSON.stringify(this.ranges)
  }
}
exports.PosMap = PosMap

PosMap.empty = new PosMap([])

// ;; A remapping represents a pipeline of zero or more mappings. It
// is a specialized data structured used to manage mapping through a
// series of steps, typically including inverted and non-inverted
// versions of the same step. (This comes up when ‘rebasing’ steps for
// collaboration or history management.) This class implements
// `Mappable`.
class Remapping {
  // :: (?[PosMap], ?[PosMap])
  constructor(head = [], tail = []) {
    // :: [PosMap]
    // The maps in the head of the mapping are applied to input
    // positions first, back-to-front. So the map at the end of this
    // array (if any) is the very first one applied.
    this.head = head
    // :: [PosMap]
    // The maps in the tail are applied last, front-to-back.
    this.tail = tail
    this.mirror = Object.create(null)
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
  // Map a position through this remapping, returning a mapping
  // result.
  mapResult(pos, bias) { return this._map(pos, bias, false) }

  // :: (number, ?number) → number
  // Map a position through this remapping.
  map(pos, bias) { return this._map(pos, bias, true) }

  _map(pos, bias, simple) {
    let deleted = false, recoverables = null

    for (let i = -this.head.length; i < this.tail.length; i++) {
      let map = this.get(i), rec

      if ((rec = recoverables && recoverables[i]) != null && map.touches(pos, rec)) {
        pos = map.recover(rec)
        continue
      }

      let result = map.mapResult(pos, bias)
      if (result.recover != null) {
        let corr = this.mirror[i]
        if (corr != null) {
          if (result.deleted) {
            i = corr
            pos = this.get(corr).recover(result.recover)
            continue
          } else {
            ;(recoverables || (recoverables = Object.create(null)))[corr] = result.recover
          }
        }
      }

      if (result.deleted) deleted = true
      pos = result.pos
    }

    return simple ? pos : new MapResult(pos, deleted)
  }

  toString() {
    let maps = []
    for (let i = -this.head.length; i < this.tail.length; i++)
      maps.push(i + ":" + this.get(i) + (this.mirror[i] != null ? "->" + this.mirror[i] : ""))
    return maps.join("\n")
  }
}
exports.Remapping = Remapping

// :: ([Mappable], number, ?number, ?number) → number
// Map the given position through an array of mappables. When `start`
// is given, the mapping is started at that array position.
function mapThrough(mappables, pos, bias, start) {
  for (let i = start || 0; i < mappables.length; i++)
    pos = mappables[i].map(pos, bias)
  return pos
}
exports.mapThrough = mapThrough

// :: ([Mappable], number, ?number, ?number) → MapResult
// Map the given position through an array of mappables, returning a
// `MapResult` object.
function mapThroughResult(mappables, pos, bias, start) {
  let deleted = false
  for (let i = start || 0; i < mappables.length; i++) {
    let result = mappables[i].mapResult(pos, bias)
    pos = result.pos
    if (result.deleted) deleted = true
  }
  return new MapResult(pos, deleted)
}
exports.mapThroughResult = mapThroughResult
