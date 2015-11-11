import {eventMixin} from "./event"

export class MarkedRange {
  constructor(from, to, options) {
    this.options = options || {}
    this.from = from
    this.to = to
  }

  clear() {
    this.signal("removed", this.from)
    this.from = this.to = null
  }
}

eventMixin(MarkedRange)

class RangeSorter {
  constructor() {
    this.sorted = []
  }

  find(at) {
    let min = 0, max = this.sorted.length
    for (;;) {
      if (max < min + 10) {
        for (let i = min; i < max; i++)
          if (this.sorted[i].at.cmp(at) >= 0) return i
        return max
      }
      let mid = (min + max) >> 1
      if (this.sorted[mid].at.cmp(at) > 0) max = mid
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
      while (pos > 0 && this.sorted[pos - 1].at.cmp(at) > 0) {
        this.sorted[pos] = this.sorted[pos - 1]
        this.sorted[--pos] = cur
      }
    }
  }
}

export class RangeStore {
  constructor(pm) {
    this.pm = pm
    this.ranges = []
    this.sorted = new RangeSorter
  }

  addRange(range) {
    this.ranges.push(range)
    this.sorted.insert({type: "open", at: range.from, range: range})
    this.sorted.insert({type: "close", at: range.to, range: range})
    this.pm.markRangeDirty(range)
  }

  removeRange(range) {
    let found = this.ranges.indexOf(range)
    if (found > -1) {
      this.ranges.splice(found, 1)
      this.sorted.remove(range.from, range)
      this.sorted.remove(range.to, range)
      this.pm.markRangeDirty(range)
      range.clear()
    }
  }

  transform(mapping) {
    for (let i = 0; i < this.ranges.length; i++) {
      let range = this.ranges[i]
      range.from = mapping.map(range.from, range.options.inclusiveLeft ? -1 : 1).pos
      range.to = mapping.map(range.to, range.options.inclusiveRight ? 1 : -1).pos
      let diff = range.from.cmp(range.to)
      if (range.options.clearWhenEmpty !== false && diff >= 0) {
        this.removeRange(range)
        i--
      } else if (diff > 0) {
        range.to = range.from
      }
    }
    this.sorted.resort()
  }

  activeRangeTracker() {
    return new RangeTracker(this.sorted.sorted)
  }
}

class RangeTracker {
  constructor(sorted) {
    this.sorted = sorted
    this.pos = 0
    this.current = []
  }

  advanceTo(pos) {
    let next
    while (this.pos < this.sorted.length && (next = this.sorted[this.pos]).at.cmp(pos) <= 0) {
      let className = next.range.options.className
      if (!className) continue
      if (next.type == "open")
        this.current.push(className)
      else
        this.current.splice(this.current.indexOf(className), 1)
      this.pos++
    }
  }

  nextChangeBefore(pos) {
    for (;;) {
      if (this.pos == this.sorted.length) return null
      let next = this.sorted[this.pos]
      if (!next.range.options.className)
        this.pos++
      else if (next.at.cmp(pos) >= 0)
        return null
      else
        return next.at.offset
    }
  }
}
