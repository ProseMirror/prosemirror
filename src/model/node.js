import {Fragment} from "./fragment"
import {Mark} from "./mark"
import {ModelError} from "./error"
import {Slice, replace} from "./replace"

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
    this.content = content || Fragment.empty

    // :: [Mark]
    // The marks (things like whether it is emphasized or part of a
    // link) associated with this node.
    this.marks = marks || emptyArray
  }

  // :: number
  // The size of this node. For text node, this is the amount of
  // characters. For leaf nodes, it is one. And for non-leaf nodes, it
  // is the size of the content plus two (the start and end token).
  get nodeSize() { return this.type.contains ? 2 + this.content.size : 1 }

  // :: number
  // The number of children that the node has.
  get childCount() { return this.content.childCount }

  child(index) { return this.content.child(index) }

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
  // Test whether two nodes represent the same content.
  eq(other) {
    if (this == other) return true
    return this.sameMarkup(other) && this.content.eq(other.content)
  }

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
  cut(from, to) {
    if (from == 0 && to == this.content.size) return this
    return this.copy(this.content.cut(from, to))
  }

  slice(from, to = this.content.size) {
    if (from == to) return Slice.empty

    from = this.resolve(from)
    to = this.resolve(to)
    let depth = from.sameDepth(to), start = from.start(depth)
    let content = from.node[depth].content.cut(from.pos - start, to.pos - start)
    return new Slice(content, from.depth - depth, to.depth - depth)
  }

  replace(from, to, slice) {
    return replace(this.resolve(from), this.resolve(to), slice)
  }

  // :: (number) → Node
  // Find the node after the given position.
  nodeAt(pos) {
    for (let node = this;;) {
      let index = findIndex(node.content, pos)
      node = node.child(index)
      if (foundOffset == pos || node.isText) return node
      pos -= foundOffset + 1
    }
  }

  // :: (?number, ?number, (node: Node, pos: number, parent: Node))
  // Iterate over all nodes between the given two positions, calling
  // the callback with the node, its position, and its parent
  // node. `from` and `to` may be left off, to denote
  // starting at the start of the node or ending at its end.
  nodesBetween(from, to, f, pos = 0) {
    this.content.nodesBetween(from, to, f, pos, this)
  }

  resolve(pos, cache) {
    return cache === false ? ResolvedPos.resolve(this, pos) : resolveCached(this, pos)
  }

  // :: (number) → [Mark]
  // Get the marks of the node before the given position or, if that
  // position is at the start of a non-empty node, those of the node
  // after it.
  marksAt(pos) {
    let r = this.resolve(pos), top = r.parent, index = r.index[r.depth]
    let leaf = index ? top.child(index - 1) : index < top.childCount ? top.child(index) : null
    return leaf ? leaf.marks : emptyArray
  }

  // :: (?number, ?number, MarkType) → bool
  // Test whether a mark of the given type occurs in this document
  // between the two given positions.
  rangeHasMark(from, to, type) {
    let found = false
    this.nodesBetween(from, to, node => {
      if (type.isInSet(node.marks)) found = true
      return !found
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
    if (this.content.size)
      obj.content = this.content.toJSON()
    if (this.marks.length)
      obj.marks = this.marks.map(n => n.toJSON())
    return obj
  }

  // :: (Schema, Object) → Node
  // Deserialize a node from its JSON representation.
  static fromJSON(schema, json) {
    let type = schema.nodeType(json.type)
    let content = json.text != null ? json.text : Fragment.fromJSON(schema, json.content)
    return type.create(json.attrs, content, json.marks && json.marks.map(schema.markFromJSON))
  }

  // This is a hack to be able to treat a node object as an iterator result
  get value() { return this }
}

// ;; #forward=Node
export class TextNode extends Node {
  constructor(type, attrs, content, marks) {
    super(type, attrs, null, marks)

    if (!content) throw new SchemaError("Empty text nodes are not allowed")

    // :: ?string
    // For text nodes, this contains the node's text content.
    this.text = content
  }

  toString() { return wrapMarks(this.marks, JSON.stringify(this.text)) }

  get textContent() { return this.text }

  get nodeSize() { return this.text.length }

  mark(marks) {
    return new TextNode(this.type, this.attrs, this.text, marks)
  }

  cut(from = 0, to = this.text.length) {
    if (from == 0 && to == this.text.length) return this
    return this.copy(this.text.slice(from, to))
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

let foundOffset = 0
function findIndex(fragment, pos, round = -1) {
  if (pos == 0) { foundOffset = pos; return 0 }
  if (pos == fragment.size) { foundOffset = pos; return fragment.content.length }
  if (pos > fragment.size || pos < 0) throw new ModelError(`Position ${pos} outside of fragment (${fragment})`)
  for (let i = 0, curPos = 0;; i++) {
    let cur = fragment.child(i), end = curPos + cur.nodeSize
    if (end >= pos) {
      if (end == pos || round > 0) { foundOffset = end; return i + 1 }
      foundOffset = curPos; return i
    }
    curPos = end
  }
}

export class ResolvedPos {
  constructor(pos, node, index, offset, parentOffset) {
    this.pos = pos
    this.node = node
    this.index = index
    this.offset = offset
    this.parentOffset = parentOffset
  }

  get parent() { return this.node[this.depth] }

  get depth() { return this.node.length - 1 }

  get nodeAfter() {
    let parent = this.parent, index = this.index[this.depth]
    if (index == parent.childCount) return null
    let dOff = this.parentOffset - this.offset[this.depth], child = parent.child(index)
    return dOff ? parent.child(index).cut(dOff) : child
  }

  get nodeBefore() {
    let index = this.index[this.depth]
    let dOff = this.parentOffset - this.offset[this.depth]
    if (dOff) return this.parent.child(index).cut(0, dOff)
    return index == 0 ? null : this.parent.child(index - 1)
  }

  sameDepth(other) {
    let depth = 0, max = Math.min(this.depth, other.depth)
    while (depth < max && this.index[depth] == other.index[depth]) ++depth
    return depth
  }

  start(depth = this.depth) {
    let pos = 0
    for (let i = 0; i < depth; i++) pos += this.offset[i] + 1
    return pos
  }

  end(depth) {
    return this.start(depth) + this.node[depth].content.size
  }

  move(pos) {
    let diff = pos - this.pos
    let index = this.index.slice(), offset = this.offset.slice(), parent = this.parent
    let parentOffset = this.parentOffset + diff
    index[this.depth] = findIndex(parent.content, parentOffset)
    offset[this.depth] = foundOffset
    return new ResolvedPos(pos, this.node, index, offset, parentOffset)
  }

  static resolve(doc, pos) {
    let nodes = [], index = [], offset = [], parentOffset = pos
    for (let node = doc;;) {
      let i = findIndex(node.content, parentOffset)
      let rem = parentOffset - foundOffset
      nodes.push(node)
      offset.push(foundOffset)
      index.push(i)
      if (!rem) break
      node = node.child(i)
      if (node.isText) break
      parentOffset = rem - 1
    }
    return new ResolvedPos(pos, nodes, index, offset, parentOffset)
  }
}

let resolveCache = [], resolveCachePos = 0, resolveCacheSize = 6
function resolveCached(doc, pos) {
  let near = null
  for (let i = 0; i < resolveCache.length; i++) {
    let cached = resolveCache[i]
    if (cached.node[0] == doc) {
      if (cached.pos == pos) return cached
      let start = cached.start()
      if (cached.depth && pos > start && pos < start + cached.parent.content.size)
        near = cached
    }
  }
  let result = near ? near.move(pos) : ResolvedPos.resolve(doc, pos)
  resolveCache[resolveCachePos] = result
  resolveCachePos = (resolveCachePos + 1) % resolveCacheSize
  return result
}
