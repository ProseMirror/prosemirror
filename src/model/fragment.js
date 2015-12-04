import {sameMarks} from "./mark"

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
    this.forEach(n => text += n.textContent)
    return text
  }

  toString() {
    let str = ""
    this.forEach(n => str += (str ? ", " : "") + n.toString())
    return str
  }

  toArray(from = 0, to = this.size, f) {
    let result = []
    for (let iter = this.iter(from, to), n; n = iter.next().value;) result.push(f ? f(n) : n)
    return result
  }

  map(f) {
    return Fragment.fromArray(this.toArray(undefined, undefined, f))
  }

  some(f) {
    for (let iter = this.iter(), n; n = iter.next().value;)
      if (f(n)) return n
  }

  close(depth, side) {
    let child = side == "start" ? this.firstChild : this.lastChild
    let closed = child.close(depth - 1, side)
    if (closed == child) return this
    return this.replace(side == "start" ? 0 : this.size - 1, closed)
  }

  nodesBetween(from, to, f, path, parent) {
    let moreFrom = from && from.depth > path.length, moreTo = to && to.depth > path.length
    let start = moreFrom ? from.path[path.length] : from ? from.offset : 0
    let end = moreTo ? to.path[path.length] + 1 : to ? to.offset : this.size
    for (let iter = this.iter(start, end), node; node = iter.next().value;) {
      let startOffset = iter.offset - node.width
      path.push(startOffset)
      node.nodesBetween(moreFrom && startOffset == start ? from : null,
                        moreTo && iter.offset == end ? to : null,
                        f, path, parent)
      path.pop()
    }
  }

  sliceBetween(from, to, depth = 0) {
    let moreFrom = from && from.depth > depth, moreTo = to && to.depth > depth
    let start = moreFrom ? from.path[depth] : from ? from.offset : 0
    let end = moreTo ? to.path[depth] + 1 : to ? to.offset : this.size
    let nodes = []
    for (let iter = this.iter(start, end), node; node = iter.next().value;) {
      let passFrom = moreFrom && (iter.offset - node.width) == start ? from : null
      let passTo = moreTo && iter.offset == end ? to : null
      if (passFrom || passTo)
        node = node.sliceBetween(passFrom, passTo, depth + 1)
      nodes.push(node)
    }
    return new this.constructor(nodes)
  }

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

const iterEnd = {done: true}

class FlatIterator {
  constructor(array, pos, end) {
    this.array = array
    this.pos = pos
    this.end = end
  }

  atEnd() { return this.pos == this.end }

  next() {
    return this.pos == this.end ? iterEnd : this.array[this.pos++]
  }

  get offset() { return this.pos }
}

class ReverseFlatIterator extends FlatIterator {
  next() {
    return this.pos == this.end ? iterEnd : this.array[--this.pos]
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

  iter(start = 0, end = this.size) {
    return new FlatIterator(this.content, start, end)
  }
  reverseIter(start = this.size, end = 0) {
    return new ReverseFlatIterator(this.content, start, end)
  }

  get size() { return this.content.length }

  get firstChild() { return this.content.length ? this.content[0] : null }
  get lastChild() { return this.content.length ? this.content[this.content.length - 1] : null }

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
    let before = this.content[last], after = other.firstChild
    if (joinLeft > 0 && joinRight > 0 && before.sameMarkup(after))
      content.push(before.append(after.content, joinLeft - 1, joinRight - 1))
    else
      content.push(before.close(joinLeft - 1, "end"), after.close(joinRight - 1, "start"))
    return Fragment.fromArray(content.concat(other.toArray(after.width)))
  }

  toJSON() {
    return this.content.map(n => n.toJSON())
  }
}

export const emptyFragment = new FlatFragment([])

class TextIterator {
  constructor(fragment, startOffset, endOffset) {
    this.frag = fragment
    this.offset = startOffset
    this.pos = -1
    this.end = endOffset
  }

  atEnd() { return this.offset == this.end }

  next() {
    if (this.pos == -1) {
      let start = this.init()
      if (start) return start
    }
    return this.offset == this.end ? iterEnd : this.advance()
  }

  advance() {
    let node = this.frag.content[this.pos++], end = this.offset + node.width
    if (end > this.end) {
      node = node.copy(node.text.slice(0, this.end - this.offset))
      this.offset = this.end
      return node
    }
    this.offset = end
    return node
  }

  init() {
    this.pos = 0
    let offset = 0
    while (offset < this.offset) {
      let node = this.frag.content[this.pos++], end = offset + node.width
      if (end == this.offset) break
      if (end > this.offset) {
        let sliceEnd = node.width
        if (end > this.end) {
          sliceEnd = this.end - offset
          end = this.end
        }
        node = node.copy(node.text.slice(this.offset - offset, sliceEnd))
        this.offset = end
        return node
      }
      offset = end
    }
  }
}

class ReverseTextIterator extends TextIterator {
  advance() {
    let node = this.frag.content[--this.pos], end = this.offset - node.width
    if (end < this.end) {
      node = node.copy(node.text.slice(this.end - end))
      this.offset = this.end
      return node
    }
    this.offset = end
    return node
  }

  init() {
    this.pos = this.frag.content.length
    let offset = this.frag.size
    while (offset > this.offset) {
      let node = this.frag.content[--this.pos], end = offset - node.width
      if (end == this.offset) break
      if (end < this.offset) {
        if (end < this.end) {
          node = node.copy(node.text.slice(this.end - end, this.offset - end))
          end = this.end
        } else {
          node = node.copy(node.text.slice(0, this.offset - end))
        }
        this.offset = end
        return node
      }
      offset = end
    }
  }
}

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

  get firstChild() { return this.size ? this.content[0] : null }
  get lastChild() { return this.size ? this.content[this.content.length - 1] : null }

  iter(from = 0, to = this.size) {
    return new TextIterator(this, from, to)
  }
  reverseIter(from = this.size, to = 0) {
    return new ReverseTextIterator(this, from, to)
  }

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

  slice(from = 0, to = this.size) {
    if (from == to) return emptyFragment
    return new TextFragment(this.toArray(from, to))
  }

  replace(off, node) {
    if (node.isText) throw new Error("Argument to replace should be a non-text node")
    let curNode, index
    for (let curOff = 0; curOff < off; index++) {
      curNode = this.content[index]
      curOff += curNode.width
    }
    if (curNode.isText) throw new Error("Can not replace text content with replace method")
    let copy = this.content.slice()
    copy[index] = node
    return new TextFragment(copy)
  }

  appendInner(other, joinLeft, joinRight) {
    let last = this.content.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = other.firstChild
    let same = before.sameMarkup(after)
    if (same && before.isText && sameMarks(before.marks, after.marks))
      content.push(before.copy(before.text + after.text))
    else if (same && joinLeft > 0 && joinRight > 0)
      content.push(before.append(after.content, joinLeft - 1, joinRight - 1))
    else
      content.push(before.close(joinLeft - 1, "end"), after.close(joinRight - 1, "start"))
    return Fragment.fromArray(content.concat(other.toArray(after.width)))
  }

  toJSON() {
    return this.content.map(n => n.toJSON())
  }
}

if (typeof Symbol != "undefined") {
  Fragment.prototype[Symbol.iterator] = function() { return this.iter() }
  FlatIterator.prototype[Symbol.iterator] = TextIterator.prototype[Symbol.iterator] = function() { return this }
}
