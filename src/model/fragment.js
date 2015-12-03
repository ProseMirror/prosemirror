export class Fragment {
  append(other, joinLeft = 0, joinRight = 0) {
    if (!this.size)
      return joinRight ? other.replace(0, other.child(0).close(joinRight - 1, "start")) : other
    if (!other.size)
      return joinLeft ? this.replace(this.size - 1, this.child(this.size - 1).close(joinLeft - 1, "end")) : this
    return this.appendInner(other, joinLeft, joinRight)
  }

  get textContent() {
    let text = ""
    for (let i = 0; i < this.chunkLength; i++)
      text += this.chunkAt(i).textContent
    return text
  }

  toString() {
    let str = ""
    this.forEach(n => str += (str ? ", " : "") + n.toString())
    return str
  }

  map(f) { return Fragment.fromArray(this.content.map(f)) }
  some(f) { return this.content.some(f) }

  static fromJSON(schema, value) {
    return value ? this.fromArray(value.map(schema.nodeFromJSON)) : emptyFragment
  }

  static fromArray(array) {
    if (!array.length) return emptyFragment
    let hasText = false
    for (let i = 0; i < array.length; i++)
      if (array[i].isText) hasText = true
    return new (hasText ? TextFragment : FlatFragment)(array)
  }

  static from(nodes) {
    if (!nodes) return emptyFragment
    if (nodes instanceof Fragment) return nodes
    return this.fromArray(Array.isArray(nodes) ? nodes : [nodes])
  }
}

class FlatFragment extends Fragment {
  constructor(content) {
    super()
    this.content = content
  }

  chunkIndex(elt, start) { return this.content.indexOf(elt, start || 0) }
  chunkAt(i) { return this.content[i] }
  get chunkLength() { return this.content.length }

  get size() { return this.content.length }

  child(off) {
    if (off < 0 || off >= this.content.length) throw new Error("Offset " + off + " out of range")
    return this.content[off]
  }

  forEach(f) {
    for (let i = 0; i < this.content.length; i++)
      f(this.content[i], i, i + 1)
  }

  chunkBefore(off) { return {node: this.child(off - 1), start: off - 1} }
  chunkAfter(off) { return {node: this.child(off), start: off} }

  slice(from, to = this.size) {
    if (from == to) return emptyFragment
    return new FlatFragment(this.content.slice(from, to))
  }

  replace(i, node) {
    if (node.isText) throw new Error("Argument to replace should be a non-text node")
    let copy = this.content.slice()
    copy[i] = node
    return new FlatFragment(copy)
  }

  appendInner(other, joinLeft, joinRight) {
    let last = this.content.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = other.child(0)
    if (joinLeft > 0 && joinRight > 0 && before.sameMarkup(after))
      content.push(before.append(after.content, joinLeft - 1, joinRight - 1))
    else
      content.push(before.close(joinLeft - 1, "end"), after.close(joinRight - 1, "start"))
    for (let i = 1; i < other.chunkLength; i++) content.push(other.chunkAt(i))
    return Fragment.fromArray(content)
  }

  close(depth, side) {
    let off = side == "start" ? 0 : this.size - 1, child = this.content[off]
    let closed = child.close(depth - 1, side)
    return closed == child ? this : this.replace(off, closed)
  }

  nodesBetween(from, to, f, path, parent) {
    let moreFrom = from && from.depth > path.length, moreTo = to && to.depth > path.length
    let start = moreFrom ? from.path[path.length] : from ? from.offset : 0
    let end = moreTo ? to.path[path.length] + 1 : to ? to.offset : this.size
    for (let i = start; i < end; i++) {
      path.push(i)
      this.content[i].nodesBetween(moreFrom && i == start ? from : null,
                                   moreTo && i == end - 1 ? to : null,
                                   f, path, parent)
      path.pop()
    }
  }

  sliceBetween(from, to, depth = 0) {
    let moreFrom = from && from.depth > depth, moreTo = to && to.depth > depth
    let start = moreFrom ? from.path[depth] : from ? from.offset : 0
    let end = moreTo ? to.path[depth] + 1 : to ? to.offset : this.size
    let result = []
    for (let i = start; i < end; i++) {
      let passFrom = moreFrom && i == start ? from : null
      let passTo = moreTo && i == end - 1 ? to : null
      if (passFrom || passTo)
        result.push(this.content[i].sliceBetween(passFrom, passTo, depth + 1))
      else
        result.push(this.content[i])
    }
    return new FlatFragment(result)
  }

  toJSON() {
    return this.content.map(n => n.toJSON())
  }
}

export const emptyFragment = new FlatFragment([])

class TextFragment extends Fragment {
  constructor(content, size) {
    super()
    this.content = content
    this.size = size || 0
    if (size == null) for (let i = 0; i < content.length; i++)
      this.size += content[i].width
  }

  chunkIndex(elt, start) { return this.content.indexOf(elt, start || 0) }
  chunkAt(i) { return this.content[i] }
  get chunkLength() { return this.content.length }

  child(off) {
    if (off < 0 || off >= this.size) throw new Error("Offset " + off + " out of range")
    for (let i = 0, curOff = 0; i < this.content.length; i++) {
      let child = this.content[i]
      curOff += child.width
      if (curOff > off) return child
    }
  }

  forEach(f) {
    for (let i = 0, off = 0; i < this.content.length; i++) {
      let child = this.content[i]
      f(child, off, off += child.width)
    }
  }

  chunkBefore(off) {
    if (!off) throw new Error("No chunk before start of node")
    for (let i = 0, curOff = 0; i < this.content.length; i++) {
      let child = this.content[i], end = curOff + child.width
      if (end >= off) return {node: child, start: curOff}
      curOff = end
    }
  }

  chunkAfter(off) {
    if (off == this.size) throw new Error("No chunk after end of node")
    for (let i = 0, curOff = 0; i < this.content.length; i++) {
      let child = this.content[i], end = curOff + child.width
      if (end > off) return {node: child, start: curOff}
      curOff = end
    }
  }

  slice(from, to = this.size) {
    if (from == to) return emptyFragment
    let result = []
    for (let i = 0, off = 0; off < to; i++) {
      let child = this.content[i], width = child.width, end = off + width
      if (end > from) {
        if (child.isText) {
          let cutFrom = Math.max(0, from - off), cutTo = Math.min(width, to - off)
          if (cutFrom == 0 && cutTo == width)
            result.push(child)
          else
            result.push(child.copy(child.text.slice(cutFrom, cutTo)))
        } else {
          result.push(child)
        }
      }
      off = end
    }
    return new TextFragment(result)
  }

  replace(off, node) {
    if (node.isText) throw new Error("Argument to replace should be a non-text node")
    for (let i = 0, curOff = 0;; i++) {
      let child = this.content[i]
      curOff += child.width
      if (curOff > off) {
        if (child.isText) throw new Error("Can not replace text content with replace method")
        let copy = this.content.slice()
        copy[i] = node
        return new TextFragment(copy)
      }
    }
  }

  appendInner(other, joinLeft, joinRight) {
    let last = this.content.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = other.chunkAt(0)
    if ((before.isText || (joinLeft > 0 && joinRight > 0)) && before.sameMarkup(after)) {
      if (before.isText)
        content.push(before.copy(before.text + after.text))
      else
        content.push(before.append(after.content, joinLeft - 1, joinRight - 1))
    } else {
      content.push(before.close(joinLeft - 1, "end"), after.close(joinRight - 1, "start"))
    }
    for (let i = 1; i < other.chunkLength; i++) content.push(other.chunkAt(i))
    return Fragment.fromArray(content)
  }

  close(depth, side) {
    let off = side == "start" ? 0 : this.content.length - 1, child = this.content[off]
    let closed = child.close(depth - 1, side)
    if (closed == child) return this
    let copy = this.content.slice()
    copy[off] = closed
    return new TextFragment(copy)
  }

  nodesBetween(from, to, f, path, parent) {
    let moreFrom = from && from.depth > path.length, moreTo = to && to.depth > path.length
    let start = !from ? 0 : moreFrom ? from.path[path.length] : from.offset
    let end = !to ? this.size : moreTo ? to.path[path.length] + 1 : to.offset
    if (start == end) return
    for (let i = 0, off = 0; off < end; i++) {
      let child = this.content[i], endOff = off + child.width
      if (endOff > start) {
        path.push(off)
        child.nodesBetween(moreFrom && off <= start ? from : null,
                           moreTo && endOff >= end ? to : null,
                           f, path, parent)
        path.pop()
      }
      off = endOff
    }
  }

  sliceBetween(from, to, depth = 0) {
    let moreFrom = from && from.depth > depth, moreTo = to && to.depth > depth
    let start = moreFrom ? from.path[depth] : from ? from.offset : 0
    let end = moreTo ? to.path[depth] + 1 : to ? to.offset : this.size
    let result = []
    for (let i = 0, off = 0; off < end; i++) {
      let child = this.content[i], width = child.width, endOff = off + width
      if (endOff > start) {
        if (child.isText) {
          let cutFrom = Math.max(0, start - off), cutTo = Math.min(width, end - off)
          if (cutFrom > 0 || cutTo < width)
            child = child.copy(child.text.slice(cutFrom, cutTo))
        }
        let passFrom = moreFrom && i == start ? from : null
        let passTo = moreTo && i == end - 1 ? to : null
        if (passFrom || passTo)
          result.push(child.sliceBetween(passFrom, passTo, depth + 1))
        else
          result.push(child)
      }
      off = endOff
    }
    return new TextFragment(result)
  }

  toJSON() {
    return this.content.map(n => n.toJSON())
  }
}
