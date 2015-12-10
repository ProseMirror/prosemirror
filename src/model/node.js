import {Fragment, emptyFragment} from "./fragment"
import {sameMarks} from "./mark"

const emptyArray = []

// ;; This class represents a node in the tree that makes up a
// ProseMirror document. So a document is an instance of `Node`, with
// children that are also instances of `Node`.
export class Node {
  // :: (NodeType, Object, ?Fragment, ?[Mark])
  // Construct a node with the given type and attributes. You'll usually
  // want to create nodes using [`Schema.node`](#Schema.node), which
  // will convert strings to node types and normalize attributes for
  // you.
  constructor(type, attrs, content, marks) {
    this.type = type
    this.attrs = attrs
    this.content = content || emptyFragment
    this.marks = marks || emptyArray
  }

  // :: number
  // The size of the node's content, which is the maximum offset in
  // the node. For nodes that don't contain text, this is also the
  // number of child nodes that the node has.
  get size() { return this.content.size }

  // :: number
  // The width of this node. Always 1 for non-text nodes, and the
  // length of the text for text nodes.
  get width() { return 1 }

  // :: (number) → Node
  // Retrieve the child at the given offset. Note that this is **not**
  // the appropriate way to loop over a node. `child`'s complexity may
  // be non-constant for some nodes, and it will return the same node
  // multiple times when calling it for different offsets within a
  // text node.
  child(off) { return this.content.child(off) }

  // :: (?number, ?number) → Iterator<Node>
  // Create an iterator over this node's children, optionally starting
  // and ending at a given offset.
  iter(start, end) { return this.content.iter(start, end) }

  // :: (?number, ?number) → Iterator<Node>
  // Create a reverse iterator (iterating from the node's end towards
  // its start) over this node's children, optionally starting and
  // ending at a given offset. **Note**: if given, `start` should be
  // greater than (or equal) to `end`.
  reverseIter(start, end) { return this.content.reverseIter(start, end) }

  // :: (number) → {start: number, node: Node}
  // Find the node that sits before a given offset. Can be used to
  // find out which text node covers a given offset. The `start`
  // property of the return value is the starting offset of the
  // returned node. It is an error to call this with offset 0.
  chunkBefore(off) { return this.content.chunkBefore(off) }

  // :: (number) → {start: number, node: Node}
  // Find the node that sits after a given offset. The `start`
  // property of the return value is the starting offset of the
  // returned node. It is an error to call this with offset
  // corresponding to the end of the node.
  chunkAfter(off) { return this.content.chunkAfter(off) }

  // :: ((node: Node, start: number, end: number))
  // Call the given function for each child node. The function will be
  // given the node, as well as its start and end offsets, as
  // arguments.
  forEach(f) { this.content.forEach(f) }

  // :: string
  // Concatenate all the text nodes found in this fragment and its
  // childen.
  get textContent() { return this.content.textContent }

  // :: ?Node
  // Returns this node's first child, or `null` if there are no
  // children.
  get firstChild() { return this.content.firstChild }

  // :: ?Node
  // Returns this node's last child, or `null` if there are no
  // children.
  get lastChild() { return this.content.lastChild }

  // :: (Node) → bool
  // Compare the markup (type, attributes, and marks) of this node to
  // those of another. Returns `true` if both have the same markup.
  sameMarkup(other) {
    return this.hasMarkup(other.type, other.attrs, other.marks)
  }

  // :: (NodeType, ?Object, ?[Mark]) → bool
  // Check whether this node's markup correspond to the given type,
  // attributes, and marks.
  hasMarkup(type, attrs, marks) {
    return this.type == type && Node.sameAttrs(this.attrs, attrs) && sameMarks(this.marks, marks || emptyArray)
  }

  static sameAttrs(a, b) {
    if (a == b) return true
    let empty = isEmpty(a)
    if (empty != isEmpty(b)) return false
    if (!empty) for (var prop in a)
      if (a[prop] !== b[prop]) return false
    return true
  }

  // :: (?Fragment) → Node
  // Create a new node with the same markup as this node, containing
  // the given content (or empty, if no content is given).
  copy(content = null) {
    return new this.constructor(this.type, this.attrs, content, this.marks)
  }

  // :: ([Mark]) → Node
  // Create a copy of this node, with the given set of marks instead
  // of the node's own marks.
  mark(marks) {
    return new this.constructor(this.type, this.attrs, this.content, marks)
  }

  // :: (number, ?number) → Node
  // Create a copy of this node with only the content between the
  // given offsets. If `to` is not given, it defaults to the end of
  // the node.
  slice(from, to) {
    return this.copy(this.content.slice(from, to))
  }

  // :: (number, number, Fragment) → Node
  // Create a copy of this node with the content between the given
  // offsets replaced by the given fragment.
  splice(from, to, replace) {
    return this.copy(this.content.slice(0, from).append(replace).append(this.content.slice(to)))
  }

  // :: (Fragment, ?number, ?number) → Node
  // [Append](#Fragment.append) the given fragment to this node's
  // content, and create a new node with the result.
  append(fragment, joinLeft = 0, joinRight = 0) {
    return this.copy(this.content.append(fragment, joinLeft, joinRight))
  }

  // :: (number, Node) → Node
  // Return a copy of this node with the child at the given offset
  // replaced by the given node. **Note**: The offset should not fall
  // within a text node.
  replace(pos, node) {
    return this.copy(this.content.replace(pos, node))
  }

  // :: ([number], Node) → Node
  // Return a copy of this node with the descendant at `path` replaced
  // by the given replacement node. This will copy as many subnodes as
  // there are elements in `path`.
  replaceDeep(path, node, depth = 0) {
    if (depth == path.length) return node
    let pos = path[depth]
    return this.replace(pos, this.child(pos).replaceDeep(path, node, depth + 1))
  }

  // :: (number, string) → Node
  // “Close” this node by making sure that, if it is empty, and is not
  // allowed to be so, it has its default content inserted. When depth
  // is greater than zero, subnodes at the given side (which can be
  // `"start"` or `"end"`) are closed too. Returns itself if no work
  // is necessary, or a closed copy if something did need to happen.
  close(depth, side) {
    if (depth == 0 && this.size == 0 && !this.type.canBeEmpty)
      return this.copy(this.type.defaultContent())
    let closedContent
    if (depth > 0 && (closedContent = this.content.close(depth - 1, side)) != this.content)
      return this.copy(closedContent)
    return this
  }

  // :: ([number]) → Node
  // Get the descendant node at the given path, which is interpreted
  // as a series of offsets into successively deeper nodes.
  path(path) {
    for (var i = 0, node = this; i < path.length; node = node.child(path[i]), i++) {}
    return node
  }

  // :: (Pos) → Node
  // Get the node after the given position.
  nodeAfter(pos) {
    return this.path(pos.path).child(pos.offset)
  }

  pathNodes(path) {
    let nodes = []
    for (var i = 0, node = this;; i++) {
      nodes.push(node)
      if (i == path.length) break
      node = node.child(path[i])
    }
    return nodes
  }

  // :: (Pos, ?bool) → bool
  // Checks whether the given position is valid in this node. When
  // `requireTextblock` is true, only positions inside textblocks are
  // considered valid.
  isValidPos(pos, requireTextblock) {
    for (let i = 0, node = this;; i++) {
      if (i == pos.path.length) {
        if (requireTextblock && !node.isTextblock) return false
        return pos.offset <= node.size
      } else {
        let n = pos.path[i]
        if (n >= node.size) return false
        node = node.child(n)
      }
    }
  }

  // :: (?Pos, ?Pos, (node: Node, path: [number], parent: Node))
  // Iterate over all nodes between the given two positions, calling
  // the callback with the node, the path towards it, and its parent
  // node, as arguments. `from` and `to` may be `null` to denote
  // starting at the start of the node or ending at its end. Note that
  // the path passed to the callback is mutated as iteration
  // continues, so if you want to preserve it, make a copy.
  nodesBetween(from, to, f, path = [], parent = null) {
    if (f(this, path, parent) === false) return
    this.content.nodesBetween(from, to, f, path, this)
  }

  inlineNodesBetween(from, to, f) {
    this.nodesBetween(from, to, (node, path, parent) => {
      if (node.isInline) {
        let last = path.length - 1
        f(node, path.slice(0, last), path[last], path[last] + node.width, parent)
      }
    })
  }

  sliceBetween(from, to, depth = 0) {
    return this.copy(this.content.sliceBetween(from, to, depth))
  }

  get isBlock() { return this.type.isBlock }
  get isTextblock() { return this.type.isTextblock }
  get isInline() { return this.type.isInline }
  get isText() { return this.type.isText }

  toString() {
    let name = this.type.name
    if (this.content.size)
      name += "(" + this.content.toString() + ")"
    return wrapMarks(this.marks, name)
  }

  toJSON() {
    let obj = {type: this.type.name}
    for (let _ in this.attrs) {
      obj.attrs = this.attrs
      break
    }
    if (this.size)
      obj.content = this.content.toJSON()
    if (this.marks.length)
      obj.marks = this.marks.map(n => n.toJSON())
    return obj
  }

  // This is a hack to be able to treat a node object as an iterator result
  get value() { return this }

  static fromJSON(schema, json) {
    let type = schema.nodeType(json.type)
    let content = json.text != null ? json.text : Fragment.fromJSON(schema, json.content)
    return type.create(json.attrs, content, json.marks && json.marks.map(schema.markFromJSON))
  }
}

if (typeof Symbol != "undefined") Node.prototype[Symbol.iterator] = function() { return this.iter() }

export class TextNode extends Node {
  constructor(type, attrs, content, marks) {
    super(type, attrs, null, marks)
    this.text = content
  }

  toString() { return wrapMarks(this.marks, JSON.stringify(this.text)) }

  get textContent() { return this.text }

  get width() { return this.text.length }

  mark(marks) {
    return new TextNode(this.type, this.attrs, this.text, marks)
  }

  toJSON() {
    let base = super.toJSON()
    base.text = this.text
    return base
  }
}

function wrapMarks(marks, str) {
  for (let i = marks.length - 1; i >= 0; i--)
    str = marks[i].type.name + "(" + str + ")"
  return str
}

function isEmpty(obj) {
  if (obj) for (let _ in obj) return false
  return true
}
