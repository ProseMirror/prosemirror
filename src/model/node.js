import {Fragment, emptyFragment} from "./fragment"
import {Mark} from "./mark"
import {Pos} from "./pos"

const emptyArray = [], emptyAttrs = Object.create(null)

// ;; This class represents a node in the tree that makes up a
// ProseMirror document. So a document is an instance of `Node`, with
// children that are also instances of `Node`.
//
// Nodes are persistent data structures. Instead of changing them, you
// create new ones with the content you want. Old ones keep pointing
// at the old document shape. This is made cheaper by sharing
// structure between the old and new data as much as possible, which a
// tree shape like this (without back pointers) makes easy.
//
// **Never** directly mutate the properties of a `Node` object. See
// [this guide](guide/doc.html) for more information.
export class Node {
  constructor(type, attrs, content, marks) {
    // :: NodeType
    // The type of node that this is.
    this.type = type

    // :: Object
    // An object mapping attribute names to string values. The kind of
    // attributes allowed and required are determined by the node
    // type.
    this.attrs = attrs

    // :: Fragment
    // The node's content.
    this.content = content || emptyFragment

    // :: [Mark]
    // The marks (things like whether it is emphasized or part of a
    // link) associated with this node.
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
  // children.
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
    return this.type == type && Node.sameAttrs(this.attrs, attrs || emptyAttrs) && Mark.sameSet(this.marks, marks || emptyArray)
  }

  static sameAttrs(a, b) {
    if (a == b) return true
    for (let prop in a)
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
  // by the given replacement node. This will copy as many sub-nodes as
  // there are elements in `path`.
  replaceDeep(path, node, depth = 0) {
    if (depth == path.length) return node
    let pos = path[depth]
    return this.replace(pos, this.child(pos).replaceDeep(path, node, depth + 1))
  }

  // :: (number, string) → Node
  // “Close” this node by making sure that, if it is empty, and is not
  // allowed to be so, it has its default content inserted. When depth
  // is greater than zero, sub-nodes at the given side (which can be
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

  // :: (Pos) → ?Node
  // Get the node after the given position, if any.
  nodeAfter(pos) {
    let parent = this.path(pos.path)
    return pos.offset < parent.size ? parent.child(pos.offset) : null
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

  // :: (Pos, Pos) → {from: Pos, to: Pos}
  // Finds the narrowest sibling range (two positions that both point
  // into the same node) that encloses the given positions.
  siblingRange(from, to) {
    for (let i = 0, node = this;; i++) {
      if (node.isTextblock) {
        let path = from.path.slice(0, i - 1), offset = from.path[i - 1]
        return {from: new Pos(path, offset), to: new Pos(path, offset + 1)}
      }
      let fromEnd = i == from.path.length, toEnd = i == to.path.length
      let left = fromEnd ? from.offset : from.path[i]
      let right = toEnd ? to.offset : to.path[i]
      if (fromEnd || toEnd || left != right) {
        let path = from.path.slice(0, i)
        return {from: new Pos(path, left), to: new Pos(path, right + (toEnd ? 0 : 1))}
      }
      node = node.child(left)
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

  // :: (?Pos, ?Pos, (node: Node, path: [number], start: number, end: number, parent: Node))
  // Calls the given function for each inline node between the two
  // given positions. Pass null for `from` or `to` to start or end at
  // the start or end of the node.
  inlineNodesBetween(from, to, f) {
    this.nodesBetween(from, to, (node, path, parent) => {
      if (node.isInline) {
        let last = path.length - 1
        f(node, path.slice(0, last), path[last], path[last] + node.width, parent)
      }
    })
  }

  // :: (?Pos, ?Pos) → Node
  // Returns a copy of this node containing only the content between
  // `from` and `to`. You can pass `null` for either of them to start
  // or end at the start or end of the node.
  sliceBetween(from, to, depth = 0) {
    return this.copy(this.content.sliceBetween(from, to, depth))
  }

  // :: (Pos) → [Mark]
  // Get the marks of the node before the given position or, if that
  // position is at the start of a non-empty node, those of the node
  // after it.
  marksAt(pos) {
    let parent = this.path(pos.path)
    if (!parent.isTextblock || !parent.size) return emptyArray
    return parent.chunkBefore(pos.offset || 1).node.marks
  }

  // :: (?Pos, ?Pos, MarkType) → bool
  // Test whether a mark of the given type occurs in this document
  // between the two given positions.
  rangeHasMark(from, to, type) {
    let found = false
    this.nodesBetween(from, to, node => {
      if (type.isInSet(node.marks)) found = true
    })
    return found
  }

  // :: bool
  // True when this is a block (non-inline node)
  get isBlock() { return this.type.isBlock }

  // :: bool
  // True when this is a textblock node, a block node with inline
  // content.
  get isTextblock() { return this.type.isTextblock }

  // :: bool
  // True when this is an inline node (a text node or a node that can
  // appear among text).
  get isInline() { return this.type.isInline }

  // :: bool
  // True when this is a text node.
  get isText() { return this.type.isText }

  // :: () → string
  // Return a string representation of this node for debugging
  // purposes.
  toString() {
    let name = this.type.name
    if (this.content.size)
      name += "(" + this.content.toString() + ")"
    return wrapMarks(this.marks, name)
  }

  // :: () → Object
  // Return a JSON-serializeable representation of this node.
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

  // :: (Schema, Object) → Node
  // Deserialize a node from its JSON representation.
  static fromJSON(schema, json) {
    let type = schema.nodeType(json.type)
    let content = json.text != null ? json.text : Fragment.fromJSON(schema, json.content)
    return type.create(json.attrs, content, json.marks && json.marks.map(schema.markFromJSON))
  }
}

if (typeof Symbol != "undefined") {
  // :: () → Iterator<Node>
  // A fragment is iterable, in the ES6 sense.
  Node.prototype[Symbol.iterator] = function() { return this.iter() }
}

// ;; #forward=Node
export class TextNode extends Node {
  constructor(type, attrs, content, marks) {
    super(type, attrs, null, marks)
    // :: ?string
    // For text nodes, this contains the node's text content.
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
