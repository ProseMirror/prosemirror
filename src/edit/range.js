// ;; A marked range as created by
// [`markRange`](#ProseMirror.markRange).
class MarkedRange {
  constructor(from, to, options) {
    this.options = options || {}
    // :: ?number
    // The current start position of the range. Updated whenever the
    // editor's document is changed. Set to `null` when the marked
    // range is [removed](#ProseMirror.removeRange).
    this.from = from
    // :: ?number
    // The current end position of the range. Updated whenever the
    // editor's document is changed. Set to `null` when the marked
    // range is [removed](#ProseMirror.removeRange).
    this.to = to
  }

  remove() {
    if (this.options.onRemove) this.options.onRemove(this.from, Math.max(this.to, this.from))
    this.from = this.to = null
  }
}
exports.MarkedRange = MarkedRange

class RangeSorter {
  constructor() {
    this.sorted = []
  }

  find(at) {
    let min = 0, max = this.sorted.length
    for (;;) {
      if (max < min + 10) {
        for (let i = min; i < max; i++)
          if (this.sorted[i].at >= at) return i
        return max
      }
      let mid = (min + max) >> 1
      if (this.sorted[mid].at > at) max = mid
      else min = mid
    }
  }

  insert(obj) {
    this.sorted.splice(this.find(obj.at), 0, obj)
  }

  remove(at, range) {
    let pos = this.find(at)
    for (let dist = 0;; dist++) {
      let leftPos = pos - dist - 1, rightPos = pos + dist
      if (leftPos >= 0 && this.sorted[leftPos].range == range) {
        this.sorted.splice(leftPos, 1)
        return
      } else if (rightPos < this.sorted.length && this.sorted[rightPos].range == range) {
        this.sorted.splice(rightPos, 1)
        return
      }
    }
  }

  resort() {
    for (let i = 0; i < this.sorted.length; i++) {
      let cur = this.sorted[i]
      let at = cur.at = cur.type == "open" ? cur.range.from : cur.range.to
      let pos = i
      while (pos > 0 && this.sorted[pos - 1].at > at) {
        this.sorted[pos] = this.sorted[pos - 1]
        this.sorted[--pos] = cur
      }
    }
  }
}

class RangeStore {
  constructor(pm) {
    this.pm = pm
    this.ranges = []
    this.sorted = new RangeSorter
  }

  addRange(range) {
    this.ranges.push(range)
    this.sorted.insert({type: "open", at: range.from, range: range})
    this.sorted.insert({type: "close", at: range.to, range: range})
    if (range.options.className)
      this.pm.markRangeDirty(range.from, range.to)
  }

  removeRange(range) {
    let found = this.ranges.indexOf(range)
    if (found > -1) {
      this.ranges.splice(found, 1)
      this.sorted.remove(range.from, range)
      this.sorted.remove(range.to, range)
      if (range.options.className)
        this.pm.markRangeDirty(range.from, range.to)
      range.remove()
    }
  }

  transform(mapping) {
    for (let i = 0; i < this.ranges.length; i++) {
      let range = this.ranges[i]
      range.from = mapping.map(range.from, range.options.inclusiveLeft ? -1 : 1)
      range.to = mapping.map(range.to, range.options.inclusiveRight ? 1 : -1)
      if (range.options.removeWhenEmpty !== false && range.from >= range.to) {
        this.removeRange(range)
        i--
      } else if (range.from > range.to) {
        range.to = range.from
      }
    }
    this.sorted.resort()
  }

  activeRangeTracker() {
    return new RangeTracker(this.sorted.sorted)
  }
}
exports.RangeStore = RangeStore

function significant(obj) {
  let range = obj.range
  return range.options.className && range.from != range.to ||
    range.options.elementBefore && obj.type == "open" ||
    range.options.elementAfter && obj.type == "close"
}

class RangeTracker {
  constructor(sorted) {
    this.sorted = sorted
    this.pos = 0
    this.current = []
    this.element = null
  }

  advanceTo(pos) {
    let next
    this.element = null
    while (this.pos < this.sorted.length && (next = this.sorted[this.pos]).at <= pos) {
      if (significant(next)) {
        let className = next.range.options.className, element = next.range.options.elementBefore
        if (className) {
          if (next.type == "open")
            this.current.push(className)
          else
            this.current.splice(this.current.indexOf(className), 1)
        }
        if (element && next.type == "open" && next.at == pos) this.element = element
      }
      this.pos++
    }
  }

  nextChangeBefore(pos) {
    for (;;) {
      if (this.pos == this.sorted.length) return -1
      let next = this.sorted[this.pos]
      if (!significant(next))
        this.pos++
      else if (next.at >= pos)
        return -1
      else
        return next.at
    }
  }
}
