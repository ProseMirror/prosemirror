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
  // :: (?[PosMap], ?number)
  // Create a new remapping with the given position maps, with its
  // current start index pointing at `mapFrom`.
  constructor(maps, mapFrom = 0, mirror) {
    // :: [PosMap]
    this.maps = maps || []
    // :: number
    // The current starting position in the `maps` array, used when
    // `map` or `mapResult` is called.
    this.mapFrom = mapFrom
    this.mirror = mirror
  }

  getMirror(n) {
    if (this.mirror) for (let i = 0; i < this.mirror.length; i++)
      if (this.mirror[i] == n) return this.mirror[i + (i % 2 ? -1 : 1)]
  }

  setMirror(n, m) {
    if (!this.mirror) this.mirror = []
    this.mirror.push(n, m)
  }

  // :: (PosMap, ?number)
  // Add a map to the end of this remapping. If `mirrors` is given, it
  // should be the index of the map that is the mirror image of this
  // one.
  appendMap(map, mirrors) {
    this.maps.push(map)
    if (mirrors != null) this.setMirror(this.maps.length - 1, mirrors)
  }

  // :: (number, ?number) → MapResult
  // Map a position through this remapping, returning a mapping
  // result.
  mapResult(pos, bias) { return this._map(pos, bias, false) }

  // :: (number, ?number) → number
  // Map a position through this remapping.
  map(pos, bias) {
    if (this.mirror) return this._map(pos, bias, true)
    for (let i = this.mapFrom; i < this.maps.length; i++)
      pos = this.maps[i].map(pos, bias)
    return pos
  }

  _map(pos, bias, simple) {
    let deleted = false, recoverables = null

    for (let i = this.mapFrom; i < this.maps.length; i++) {
      let map = this.maps[i], rec = recoverables && recoverables[i]
      if (rec != null && map.touches(pos, rec)) {
        pos = map.recover(rec)
        continue
      }

      let result = map.mapResult(pos, bias)
      if (result.recover != null) {
        let corr = this.getMirror(i)
        if (corr != null && corr > i) {
          if (result.deleted) {
            i = corr
            pos = this.maps[corr].recover(result.recover)
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
