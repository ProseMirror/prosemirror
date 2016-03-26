import {ModelError} from "./error"

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
      this.size += content[i].nodeSize
  }

  // :: string
  // Concatenate all the text nodes found in this fragment and its
  // children.
  get textContent() {
    let text = ""
    this.content.forEach(n => text += n.textContent)
    return text
  }

  // :: () → string
  // Return a debugging string that describes this fragment.
  toString() { return "<" + this.toStringInner() + ">" }

  toStringInner() { return this.content.join(", ") }

  nodesBetween(from, to, f, nodeStart, parent) {
    for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i], end = pos + child.nodeSize
      if (end > from && f(child, nodeStart + pos, parent) !== false && child.content.size) {
        let start = pos + 1
        child.nodesBetween(Math.max(0, from - start),
                           Math.min(child.content.size, to - start),
                           f, nodeStart + start)
      }
      pos = end
    }
  }

  // :: (number, ?number) → Fragment
  // Cut out the sub-fragment between the two given positions.
  cut(from, to) {
    if (to == null) to = this.size
    if (from == 0 && to == this.size) return this
    let result = [], size = 0
    if (to > from) for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i], end = pos + child.nodeSize
      if (end > from) {
        if (pos < from || end > to) {
          if (child.isText)
            child = child.cut(Math.max(0, from - pos), Math.min(child.text.length, to - pos))
          else
            child = child.cut(Math.max(0, from - pos - 1), Math.min(child.content.size, to - pos - 1))
        }
        result.push(child)
        size += child.nodeSize
      }
      pos = end
    }
    return new Fragment(result, size)
  }

  // :: (Fragment) → Fragment
  // Create a new fragment containing the content of this fragment and
  // `other`.
  append(other) {
    if (!other.size) return this
    if (!this.size) return other
    let last = this.lastChild, first = other.firstChild, content = this.content.slice(), i = 0
    if (last.isText && last.sameMarkup(first)) {
      content[content.length - 1] = last.copy(last.text + first.text)
      i = 1
    }
    for (; i < other.content.length; i++) content.push(other.content[i])
    return new Fragment(content, this.size + other.size)
  }

  // :: (number, Node) → Fragment
  // Create a new fragment in which the node at the given index is
  // replaced by the given node.
  replaceChild(index, node) {
    let copy = this.content.slice()
    let size = this.size + node.nodeSize - copy[index].nodeSize
    copy[index] = node
    return new Fragment(copy, size)
  }

  // (Node) → Fragment
  // Create a new fragment by prepending the given node to this
  // fragment.
  addToStart(node) {
    return new Fragment([node].concat(this.content), this.size + node.nodeSize)
  }

  // (Node) → Fragment
  // Create a new fragment by appending the given node to this
  // fragment.
  addToEnd(node) {
    return new Fragment(this.content.concat(node), this.size + node.nodeSize)
  }

  // :: () → union<Object, null>
  // Create a JSON-serializeable representation of this fragment.
  toJSON() {
    return this.content.length ? this.content.map(n => n.toJSON()) : null
  }

  // :: (Schema, Object) → Fragment
  // Deserialize a fragment from its JSON representation.
  static fromJSON(schema, value) {
    return value ? new Fragment(value.map(schema.nodeFromJSON)) : Fragment.empty
  }

  // :: ([Node]) → Fragment
  // Build a fragment from an array of nodes. Ensures that adjacent
  // text nodes with the same style are joined together.
  static fromArray(array) {
    if (!array.length) return Fragment.empty
    let joined, size = 0
    for (let i = 0; i < array.length; i++) {
      let node = array[i]
      size += node.nodeSize
      if (i && node.isText && array[i - 1].sameMarkup(node)) {
        if (!joined) joined = array.slice(0, i)
        joined[joined.length - 1] = node.copy(joined[joined.length - 1].text + node.text)
      } else if (joined) {
        joined.push(node)
      }
    }
    return new Fragment(joined || array, size)
  }

  // :: (Fragment) → bool
  // Compare this fragment to another one.
  eq(other) {
    if (this.content.length != other.content.length) return false
    for (let i = 0; i < this.content.length; i++)
      if (!this.content[i].eq(other.content[i])) return false
    return true
  }

  // :: (?union<Fragment, Node, [Node]>) → Fragment
  // Create a fragment from something that can be interpreted as a set
  // of nodes. For `null`, it returns the empty fragment. For a
  // fragment, the fragment itself. For a node or array of nodes, a
  // fragment containing those nodes.
  static from(nodes) {
    if (!nodes) return Fragment.empty
    if (nodes instanceof Fragment) return nodes
    if (Array.isArray(nodes)) return this.fromArray(nodes)
    return new Fragment([nodes], nodes.nodeSize)
  }

  // :: ?Node
  // The first child of the fragment, or `null` if it is empty.
  get firstChild() { return this.content.length ? this.content[0] : null }

  // :: ?Node
  // The last child of the fragment, or `null` if it is empty.
  get lastChild() { return this.content.length ? this.content[this.content.length - 1] : null }

  // :: number
  // The number of child nodes in this fragment.
  get childCount() { return this.content.length }

  // :: (number) → Node
  // Get the child node at the given index. Raise an error when the
  // index is out of range.
  child(index) {
    let found = this.content[index]
    if (!found) throw new ModelError("Index " + index + " out of range for " + this)
    return found
  }

  // :: (number) → ?Node
  // Get the child node at the given index, if it exists.
  maybeChild(index) {
    return this.content[index]
  }

  // :: ((node: Node, offset: number))
  // Call `f` for every child node, passing the node and its offset
  // into this parent node.
  forEach(f) {
    for (let i = 0, p = 0; i < this.content.length; i++) {
      let child = this.content[i]
      f(child, p)
      p += child.nodeSize
    }
  }
}

// :: Fragment
// An empty fragment. Intended to be reused whenever a node doesn't
// contain anything (rather than allocating a new empty fragment for
// each leaf node).
Fragment.empty = new Fragment([], 0)
