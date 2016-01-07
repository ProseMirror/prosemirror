import {ModelError} from "./error"

// ;; A fragment is an abstract type used to represent a node's
// collection of child nodes. It tries to hide considerations about
// the actual way in which the child nodes are stored, so that
// different representations (nodes that only contain simple nodes
// versus nodes that also contain text) can be approached using the
// same API.
//
// Fragments are persistent data structures. That means you should
// _not_ mutate them or their content, but create new instances
// whenever needed. The API tries to make this easy.
export class Fragment {
  // :: (Fragment, number, number) → Fragment
  // Create a fragment that combines this one with another fragment.
  // Takes care of merging adjacent text nodes and can also merge
  // “open” nodes at the boundary. `joinLeft` and `joinRight` give the
  // depth to which the left and right fragments are open. If open
  // nodes with the same markup are found on both sides, they are
  // joined. If not, the open nodes are [closed](#Node.close).
  append(other, joinLeft = 0, joinRight = 0) {
    if (!this.size)
      return joinRight ? other.replace(0, other.firstChild.close(joinRight - 1, "start")) : other
    if (!other.size)
      return joinLeft ? this.replace(this.size - 1, this.lastChild.close(joinLeft - 1, "end")) : this
    return this.appendInner(other, joinLeft, joinRight)
  }

  // :: string
  // Concatenate all the text nodes found in this fragment and its
  // children.
  get textContent() {
    let text = ""
    this.forEach(n => text += n.textContent)
    return text
  }

  // :: () → string
  // Return a debugging string that describes this fragment.
  toString() {
    let str = ""
    this.forEach(n => str += (str ? ", " : "") + n.toString())
    return str
  }

  // :: (number, number, ?(Node) → Node) → [Node]
  // Produce an array with the child nodes between the given
  // boundaries, optionally mapping a function over them.
  toArray(from = 0, to = this.size, f) {
    let result = []
    for (let iter = this.iter(from, to), n; n = iter.next().value;) result.push(f ? f(n) : n)
    return result
  }

  // :: ((Node) → Node) → Fragment
  // Produce a new Fragment by mapping all this fragment's children
  // through a function.
  map(f) {
    return Fragment.fromArray(this.toArray(undefined, undefined, f))
  }

  // :: ((Node) → bool) → bool
  // Returns `true` if the given function returned `true` for any of
  // the fragment's children.
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

  // :: (?Pos, ?Pos) → Fragment
  // Slice out the sub-fragment between the two given positions.
  // `null` can be passed for either to indicate the slice should go
  // all the way to the start or end of the fragment.
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

  // :: (Schema, Object) → Fragment
  // Deserialize a fragment from its JSON representation.
  static fromJSON(schema, value) {
    return value ? this.fromArray(value.map(schema.nodeFromJSON)) : emptyFragment
  }

  // :: ([Node]) → Fragment
  // Build a fragment from an array of nodes.
  static fromArray(array) {
    if (!array.length) return emptyFragment
    let hasText = false, joined
    for (let i = 0; i < array.length; i++) {
      let node = array[i]
      if (node.isText) {
        hasText = true
        if (i && array[i - 1].sameMarkup(node)) {
          if (!joined) joined = array.slice(0, i)
          joined[joined.length - 1] = node.copy(joined[joined.length - 1].text + node.text)
          continue
        }
      }
      if (joined) joined.push(node)
    }
    return hasText ? new TextFragment(joined || array) : new FlatFragment(array)
  }

  // :: (?union<Fragment, Node, [Node]>) → Fragment
  // Create a fragment from something that can be interpreted as a set
  // of nodes. For `null`, it returns the empty fragment. For a
  // fragment, the fragment itself. For a node or array of nodes, a
  // fragment containing those nodes.
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

  copy() {
    return new this.constructor(this.array, this.pos, this.end)
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

// ;; #forward=Fragment
class FlatFragment extends Fragment {
  constructor(content) {
    super()
    this.content = content
  }

  // :: (?number, ?number) → Iterator<Node>
  // Create a forward iterator over the content of the fragment. An
  // explicit start and end offset can be given to have the iterator
  // go over only part of the content. If an iteration bound falls
  // within a text node, only the part that is within the bounds is
  // yielded.
  iter(start = 0, end = this.size) {
    return new FlatIterator(this.content, start, end)
  }

  // :: (?number, ?number) → Iterator<Node>
  // Create a reverse iterator over the content of the fragment. An
  // explicit start and end offset can be given to have the iterator
  // go over only part of the content. **Note**: `start` should be
  // greater than `end`, when passed.
  reverseIter(start = this.size, end = 0) {
    return new ReverseFlatIterator(this.content, start, end)
  }

  // :: number
  // The maximum offset in this fragment.
  get size() { return this.content.length }

  // :: ?Node
  // The first child of the fragment, or `null` if it is empty.
  get firstChild() { return this.content.length ? this.content[0] : null }

  // :: ?Node
  // The last child of the fragment, or `null` if it is empty.
  get lastChild() { return this.content.length ? this.content[this.content.length - 1] : null }

  // :: (number) → Node
  // Get the child at the given offset. Might return a text node that
  // stretches before and/or after the offset.
  child(off) {
    if (off < 0 || off >= this.content.length) ModelError.raise("Offset " + off + " out of range")
    return this.content[off]
  }

  // :: ((node: Node, start: number, end: number))
  // Call the given function for each node in the fragment, passing it
  // the node, its start offset, and its end offset.
  forEach(f) {
    for (let i = 0; i < this.content.length; i++)
      f(this.content[i], i, i + 1)
  }

  // :: (number) → {start: number, node: Node}
  // Find the node before the given offset. Returns an object
  // containing the node as well as its start index. Offset should be
  // greater than zero.
  chunkBefore(off) { return {node: this.child(off - 1), start: off - 1} }

  // :: (number) → {start: number, node: Node}
  // Find the node after the given offset. Returns an object
  // containing the node as well as its start index. Offset should be
  // less than the fragment's size.
  chunkAfter(off) { return {node: this.child(off), start: off} }

  // :: (number, ?number) → Fragment
  // Return a fragment with only the nodes between the given offsets.
  // When `to` is not given, the slice will go to the end of the
  // fragment.
  slice(from, to = this.size) {
    if (from == to) return emptyFragment
    return new FlatFragment(this.content.slice(from, to))
  }

  // :: (number, Node) → Fragment
  // Return a fragment in which the node at the given offset is
  // replaced by the given node. The node, as well as the one it
  // replaces, should not be text nodes.
  replace(offset, node) {
    if (node.isText) ModelError.raise("Argument to replace should be a non-text node")
    let copy = this.content.slice()
    copy[offset] = node
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

  // :: () → Object
  // Create a JSON-serializeable representation of this fragment.
  toJSON() {
    return this.content.map(n => n.toJSON())
  }
}

// :: Fragment
// An empty fragment. Intended to be reused whenever a node doesn't
// contain anything (rather than allocating a new empty fragment for
// each leaf node).
export const emptyFragment = new FlatFragment([])

class TextIterator {
  constructor(fragment, startOffset, endOffset, pos = -1) {
    this.frag = fragment
    this.offset = startOffset
    this.pos = pos
    this.endOffset = endOffset
  }

  copy() {
    return new this.constructor(this.frag, this.offset, this.endOffset, this.pos)
  }

  atEnd() { return this.offset == this.endOffset }

  next() {
    if (this.pos == -1) {
      let start = this.init()
      if (start) return start
    }
    return this.offset == this.endOffset ? iterEnd : this.advance()
  }

  advance() {
    let node = this.frag.content[this.pos++], end = this.offset + node.width
    if (end > this.endOffset) {
      node = node.copy(node.text.slice(0, this.endOffset - this.offset))
      this.offset = this.endOffset
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
        if (end > this.endOffset) {
          sliceEnd = this.endOffset - offset
          end = this.endOffset
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
    if (end < this.endOffset) {
      node = node.copy(node.text.slice(this.endOffset - end))
      this.offset = this.endOffset
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
        if (end < this.endOffset) {
          node = node.copy(node.text.slice(this.endOffset - end, this.offset - end))
          end = this.endOffset
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

  get firstChild() { return this.size ? this.content[0] : null }
  get lastChild() { return this.size ? this.content[this.content.length - 1] : null }

  iter(from = 0, to = this.size) {
    return new TextIterator(this, from, to)
  }
  reverseIter(from = this.size, to = 0) {
    return new ReverseTextIterator(this, from, to)
  }

  child(off) {
    if (off < 0 || off >= this.size) ModelError.raise("Offset " + off + " out of range")
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
    if (!off) ModelError.raise("No chunk before start of node")
    for (let i = 0, curOff = 0; i < this.content.length; i++) {
      let child = this.content[i], end = curOff + child.width
      if (end >= off) return {node: child, start: curOff}
      curOff = end
    }
  }

  chunkAfter(off) {
    if (off == this.size) ModelError.raise("No chunk after end of node")
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
    if (node.isText) ModelError.raise("Argument to replace should be a non-text node")
    let curNode, index
    for (let curOff = 0; curOff < off; index++) {
      curNode = this.content[index]
      curOff += curNode.width
    }
    if (curNode.isText) ModelError.raise("Can not replace text content with replace method")
    let copy = this.content.slice()
    copy[index] = node
    return new TextFragment(copy)
  }

  appendInner(other, joinLeft, joinRight) {
    let last = this.content.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = other.firstChild
    let same = before.sameMarkup(after)
    if (same && before.isText)
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
  // :: () → Iterator<Node>
  // A fragment is iterable, in the ES6 sense.
  Fragment.prototype[Symbol.iterator] = function() { return this.iter() }
  FlatIterator.prototype[Symbol.iterator] = TextIterator.prototype[Symbol.iterator] = function() { return this }
}
