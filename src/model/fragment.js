import {ModelError} from "./error"

const iterEnd = {done: true, value: null}

// ;; Fragment cursors serve two purposes. They are 'pointers' into
// the content of a fragment, and can be used to find and represent
// positions in that content. They can also be used as ES6-style
// stateful iterators.
class FragmentCursor {
  constructor(fragment, off, index, inside) {
    this.fragment = fragment
    this.off = off
    this.inside = inside
    this.index = index
  }

  // :: number
  // The offset into the pointed at element.
  get pos() {
    return this.off + this.inside
  }

  // :: () → union<Node, {done: bool}>
  // Advance to the next element, if any. Will return a `Node` object
  // (which has a `value` getter returning itself, to conform to the
  // iterator spec) when there is a next element, or an object `{done:
  // true}` if there isn't.
  next() {
    let val = this.node
    if (!val) return iterEnd
    this.index++
    this.off += val.size + this.inside
    this.inside = 0
    return val
  }

  // :: bool
  // Returns true if the cursor is at the end of the fragment.
  get atEnd() {
    return this.index == this.fragment.content.length
  }

  // :: (number) → union<Node, {done: bool}>
  // Like [`next`](#FragmentCursor.next), but will stop at the given
  // end instead of at the end of the fragment. When a node falls only
  // partially before the end, it will be sliced so that only the part
  // before the end is returned.
  nextUntil(end) {
    let cur = this.fragment.content[this.index]
    if (!cur || this.pos >= end) return iterEnd
    let curEnd = this.off + cur.size, inside = this.inside
    if (curEnd > end) {
      this.inside = end - this.off
      return cur.slice(inside ? inside - !cur.isText : 0, this.inside - !cur.isText)
    } else {
      this.index++
      this.off += cur.size
      this.inside = 0
      return inside ? cur.slice(inside - !cur.isText) : cur
    }
  }

  // :: () → union<Node, {done: bool}>
  // Iterate backwards, towards the start of the fragment.
  prev() {
    if (this.index == 0) return iterEnd
    let val = this.nodeBefore
    if (this.inside) {
      this.inside = 0
    } else {
      this.index--
      this.off -= val.size
    }
    return val
  }

  // :: bool
  // Returns true if the cursor is at the start of the fragment.
  get atStart() {
    return this.index == 0
  }

  // :: ?Node
  // Get the node that the cursor is pointing before, if any.
  get node() {
    let elt = this.fragment.content[this.index]
    return elt && (this.inside ? elt.slice(this.inside - !elt.isText) : elt)
  }

  // :: ?node
  // Get the node that the cursor is pointing after, if any.
  get nodeBefore() {
    if (this.index == 0) return null
    if (this.inside) {
      let child = this.fragment.content[this.index]
      return child.slice(0, this.inside - !child.isText)
    }
    return this.fragment.content[this.index - 1]
  }

  get nodeAround() {
    return this.fragment.content[this.index]
  }

  // :: () → FragmentCursor
  // Get a new cursor pointing one position after this one.
  after() {
    let cur = this.fragment.content[this.index].size
    if (!cur) throw new ModelError("Cursor is at end of fragment")
    return new FragmentCursor(this.fragment, this.pos + cur.size - this.inside,
                              this.index + 1, 0)
  }

  // :: () → FragmentCursor
  // Get a new cursor pointing one position before this one.
  before() {
    if (this.index == 0) throw new ModelError("Cursor is at start of fragment")
    if (this.inside) return new FragmentCursor(this.fragment, this.pos - this.inside, this.index, 0)
    return new FragmentCursor(this.fragment, this.pos - this.fragment.content[this.index - 1].size, this.index - 1, 0)
  }

  // :: () → FragmentCursor
  // Make a copy of this cursor.
  copy() {
    return new FragmentCursor(this.fragment, this.pos, this.index, this.inside)
  }
}

// ;; Fragment is the type used to represent a node's collection of
// child nodes.
//
// Fragments are persistent data structures. That means you should
// _not_ mutate them or their content, but create new instances
// whenever needed. The API tries to make this easy.
export class Fragment {
  constructor(content, size) {
    this.content = content
    this.size = size || 0
    if (size == null) for (let i = 0; i < content.length; i++)
      this.size += content[i].size
  }

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

    let last = this.content.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = other.firstChild
    let same = before.sameMarkup(after)
    if (same && before.isText)
      content.push(before.copy(before.text + after.text))
    else if (same && joinLeft > 0 && joinRight > 0)
      content.push(before.append(after.content, joinLeft - 1, joinRight - 1))
    else
      content.push(before.close(joinLeft - 1, "end"), after.close(joinRight - 1, "start"))
    return new Fragment(content.concat(other.content.slice(1)))
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

  // :: ((Node) → Node) → Fragment
  // Produce a new Fragment by mapping all this fragment's children
  // through a function.
  map(f) {
    return Fragment.fromArray(this.content.map(f))
  }

  // :: ((Node) → bool) → bool
  // Returns the true if the given function returns `true` for at
  // least one node in this fragment.
  some(f) {
    return this.content.some(f)
  }

  close(depth, side) {
    let child = side == "start" ? this.firstChild : this.lastChild
    let closed = child.close(depth - 1, side)
    if (closed == child) return this
    return this.replaceInner(side == "start" ? 0 : this.content.length - 1, closed)
  }

  replaceInner(index, node) {
    let copy = this.content.slice(), prev = copy[index]
    if (node.isText || prev.isText) throw new ModelError("Can't use Fragment.replace on text nodes")
    copy[index] = node
    return new Fragment(copy, this.size + node.size - prev.size)
  }

  // :: (FragmentCursor, Node) → Fragment
  // Return a fragment in which the node at the position pointed at by
  // the cursor is replaced by the given replacement node. Neither the
  // old nor the new node may be a text node.
  replace(cursor, node) {
    if (cursor.inside) throw new ModelError("Non-rounded cursor passed to replace")
    return this.replaceInner(cursor.index, node)
  }

  // :: (?number, ?number) → FragmentCursor
  // Create a cursor (iterator) pointing into this fragment, starting
  // at the given position. If `round` is zero or not given, the
  // iterator may start in the middle of a (non-text) child node. It
  // it is -1, positions inside a child will be rounded down, if it is
  // 1, they will be rounded up.
  cursor(start, round) {
    if (!start) return new FragmentCursor(this, 0, 0, 0)
    if (start == this.size) return new FragmentCursor(this, start, this.content.length, 0)
    if (start > this.size || start < 0) throw new ModelError(`Position ${start} outside of fragment (${this})`)
    for (let i = 0, curPos = 0;; i++) {
      let cur = this.content[i], end = curPos + cur.size
      if (end >= start) {
        if (end == start) return new FragmentCursor(this, end, i + 1, 0)
        if (cur.isText || !round) return new FragmentCursor(this, curPos, i, start - curPos)
        return new FragmentCursor(this, round < 0 ? curPos : end, i + (round > 0), 0)
      }
      curPos = end
    }
  }

  // :: ((node: Node, start: number, end: number))
  // Call the given function for each node in the fragment, passing it
  // the node, its start position, and its end position.
  forEach(f) {
    for (let i = 0, pos = 0; i < this.content.length; i++) {
      let child = this.content[i]
      f(child, pos, pos += child.size)
    }
  }

  nodesBetween(from = 0, to = this.size, f, pos, parent) {
    for (let i = 0, off = 0; i < this.content.length && off < to; i++) {
      let child = this.content[i], end = off + child.size
      if (end > from && f(child, pos + off, parent) !== false && child.content.size) {
        let start = off + 1
        child.nodesBetween(Math.max(0, from - start),
                           Math.min(child.content.size, to - start),
                           f, pos + start)
      }
      off = end
    }
  }

  // :: (?number, ?number) → Fragment
  // Slice out the sub-fragment between the two given positions.
  slice(from = 0, to = this.size) {
    let cur = this.cursor(from), child, result = []
    while (child = cur.nextUntil(to).value)
      result.push(child)
    return new Fragment(result, to - from)
  }

  // :: () → Object
  // Create a JSON-serializeable representation of this fragment.
  toJSON() {
    return this.content.length ? this.content.map(n => n.toJSON()) : null
  }

  // :: (Schema, Object) → Fragment
  // Deserialize a fragment from its JSON representation.
  static fromJSON(schema, value) {
    return value ? new Fragment(value.map(schema.nodeFromJSON)) : emptyFragment
  }

  // :: ([Node]) → Fragment
  // Build a fragment from an array of nodes. Ensures that adjacent
  // text nodes with the same style are joined together.
  static fromArray(array) {
    if (!array.length) return emptyFragment
    let joined, size = 0
    for (let i = 0; i < array.length; i++) {
      let node = array[i]
      size += node.size
      if (i && node.isText && array[i - 1].sameMarkup(node)) {
        if (!joined) joined = array.slice(0, i)
        joined[joined.length - 1] = node.copy(joined[joined.length - 1].text + node.text)
      } else if (joined) {
        joined.push(node)
      }
    }
    return new Fragment(joined || array, size)
  }

  // :: (?union<Fragment, Node, [Node]>) → Fragment
  // Create a fragment from something that can be interpreted as a set
  // of nodes. For `null`, it returns the empty fragment. For a
  // fragment, the fragment itself. For a node or array of nodes, a
  // fragment containing those nodes.
  static from(nodes) {
    if (!nodes) return emptyFragment
    if (nodes instanceof Fragment) return nodes
    if (Array.isArray(nodes)) return this.fromArray(nodes)
    return new Fragment([nodes], nodes.size)
  }

  // :: ?Node
  // The first child of the fragment, or `null` if it is empty.
  get firstChild() { return this.content.length ? this.content[0] : null }

  // :: ?Node
  // The last child of the fragment, or `null` if it is empty.
  get lastChild() { return this.content.length ? this.content[this.content.length - 1] : null }

  get childCount() { return this.content.length }
}

// :: Fragment
// An empty fragment. Intended to be reused whenever a node doesn't
// contain anything (rather than allocating a new empty fragment for
// each leaf node).
export const emptyFragment = new Fragment([], 0)

if (typeof Symbol != "undefined") {
  // :: () → Iterator<Node>
  // A fragment is iterable, in the ES6 sense.
  Fragment.prototype[Symbol.iterator] = function() { return this.cursor() }
  FragmentCursor.prototype[Symbol.iterator] = function() { return this }
}
