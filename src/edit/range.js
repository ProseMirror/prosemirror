import {signal} from "./event"

export class MarkedRange {
  constructor(from, to, options) {
    this.options = options || {}
    this.from = from
    this.to = to
  }
}

export class RangeStore {
  constructor(pm) {
    this.pm = pm
    this.ranges = []
  }

  addRange(range) {
    this.ranges.push(range)
    this.markDisplayDirty(range)
  }

  removeRange(range) {
    let found = this.ranges.indexOf(range)
    if (found > -1) {
      this.ranges.splice(found, 1)
      this.markDisplayDirty(range)
      signal(range, "removed")
    }
  }

  transform(transform) {
    for (let i = 0; i < this.ranges.length; i++) {
      let range = this.ranges[i]
      range.from = transform.map(range.from, range.options.inclusiveLeft ? -1 : 1)
      range.to = transform.map(range.to, range.options.inclusiveRight ? 1 : -1)
      let diff = range.from.cmp(range.to)
      if (range.options.clearWhenEmpty !== false && diff >= 0) {
        this.removeRange(range)
        i--
      } else if (diff > 0) {
        range.to = range.from
      }
    }
  }

  markDisplayDirty(range) {
    let dirty = this.pm.ensureOperation().dirty
    let from = range.from, to = range.to
    for (let depth = 0, node = this.pm.doc;; depth++) {
      let fromEnd = depth == from.depth, toEnd = depth == to.depth
      if (!fromEnd && !toEnd && from.path[depth] == to.path[depth]) {
        let child = node.content[from.path[depth]]
        if (!dirty.has(child)) dirty.set(child, 1)
        node = child
      } else {
        let start = fromEnd ? from.offset : from.path[depth]
        let end = toEnd ? to.offset : to.path[depth] + 1
        if (node.type.block) {
          for (let offset = 0, i = 0; offset < end; i++) {
            let child = node.content[i]
            offset += child.size
            if (offset > start) dirty.set(child, 2)
          }
        } else {
          for (let i = start; i < end; i++)
            dirty.set(node.content[i], 2)
        }
        break
      }
    }
  }

  activeRangeTracker() {
    let sorted = []
    for (let i = 0; i < this.ranges.length; i++) {
      let range = this.ranges[i]
      if (!range.options.className) continue
      sorted.push({type: "open", at: range.from, className: range.options.className})
      sorted.push({type: "close", at: range.to, className: range.options.className})
    }
    sorted.sort((a, b) => a.at.cmp(b.at))
    return new RangeTracker(sorted)
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
      if (next.type == "open")
        this.current.push(next.className)
      else
        this.current.splice(this.current.indexOf(next.className), 1)
      this.pos++
    }
  }

  nextChangeBefore(pos) {
    if (this.pos == this.sorted.length) return null
    let next = this.sorted[this.pos]
    if (next.at.cmp(pos) >= 0) return null
    return next.at.offset
  }
}
