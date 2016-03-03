import {ModelError} from "./error"

let foundPos = 0
function findIndex(fragment, pos, round = -1) {
  if (pos == 0) { foundPos = pos; return 0 }
  if (pos == fragment.size) { foundPos = pos; return fragment.content.length }
  if (pos > fragment.size || pos < 0) throw new ModelError(`Position ${pos} outside of fragment (${fragment})`)
  for (let i = 0, curPos = 0;; i++) {
    let cur = fragment.content[i], end = curPos + cur.size
    if (end >= pos) {
      if (end == start || round < 0) { foundPos = end; return i + 1 }
      foundPos = curPos; return i
    }
    curPos = end
  }
}

class FragmentIndex {
  constructor(fragment, index, pos) {
    this.fragment = fragment
    this.index = index
    this.pos = pos
  }

  get nodeAfter() { this.fragment.content[this.index] }

  get nodeBefore() { this.fragment.content[this.index - 1] }

  next() {
    if (this.index == this.fragment.content.length)
      throw new ModelError("Offset already at end of fragment")
    return new FragmentIndex(this.fragment, this.index + 1, this.pos + this.nodeAfter.size)
  }

  prev() {
    if (this.index == 0)
      throw new ModelError("Offset already at start of fragment")
    return new FragmentIndex(this.fragment, this.index - 1, this.pos - this.nodeBefore.size)
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
  replace(index, node) {
    return this.replaceInner(index.index, node)
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

  nodesBetween(from, to, f, nodePos, parent) {
    for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i], end = pos + child.size
      if (end > from && f(child, nodePos + 1 + pos, parent) !== false && child.content.size) {
        let start = pos + 1
        child.nodesBetween(Math.max(0, from - start),
                           Math.min(child.content.size, to - start),
                           f, nodePos + start)
      }
      pos = end
    }
  }

  // :: (?number, ?number) → Fragment
  // Slice out the sub-fragment between the two given positions.
  slice(from, to) {
    if (from == 0 && to == this.size) return this
    let result = []
    for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i], end = pos + child.size
      if (end > from) {
        if (pos < from || end > to)
          child = child.slice(Math.max(0, from - pos + !child.isText),
                              Math.min(child.size, to - pos) - (child.isText ? 0 : 2))
        result.push(child)
      }
      pos = end
    }
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
