import {Fragment} from "./fragment"
import {Mark} from "./mark"
import {Slice, replace} from "./replace"
import {ResolvedPos} from "./resolvedpos"

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
  get nodeSize() { return this.type.isLeaf ? 1 : 2 + this.content.size }

  // :: number
  // The number of children that the node has.
  get childCount() { return this.content.childCount }

  // :: (number) → Node
  // Get the child node at the given index. Raise an error when the
  // index is out of range.
  child(index) { return this.content.child(index) }

  // :: (number) → ?Node
  // Get the child node at the given index, if it exists.
  maybeChild(index) { return this.content.maybeChild(index) }

  // :: ((node: Node, offset: number))
  // Call `f` for every child node, passing the node and its offset
  // into this parent node.
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
    return this == other || (this.sameMarkup(other) && this.content.eq(other.content))
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
    if (content == this.content) return this
    return new this.constructor(this.type, this.attrs, content, this.marks)
  }

  // :: ([Mark]) → Node
  // Create a copy of this node, with the given set of marks instead
  // of the node's own marks.
  mark(marks) {
    return marks == this.marks ? this : new this.constructor(this.type, this.attrs, this.content, marks)
  }

  // :: (number, ?number) → Node
  // Create a copy of this node with only the content between the
  // given offsets. If `to` is not given, it defaults to the end of
  // the node.
  cut(from, to) {
    if (from == 0 && to == this.content.size) return this
    return this.copy(this.content.cut(from, to))
  }

  // :: (number, ?number) → Slice
  // Cut out the part of the document between the given positions, and
  // return it as a `Slice` object.
  slice(from, to = this.content.size) {
    if (from == to) return Slice.empty

    let $from = this.resolve(from), $to = this.resolve(to)
    let depth = $from.sameDepth($to), start = $from.start(depth), node = $from.node(depth)
    let content = node.content.cut($from.pos - start, $to.pos - start)
    return new Slice(content, $from.depth - depth, $to.depth - depth, node)
  }

  // :: (number, number, Slice) → Node
  // Replace the part of the document between the given positions with
  // the given slice. The slice must 'fit', meaning its open sides
  // must be able to connect to the surrounding content, and its
  // content nodes must be valid children for the node they are placed
  // into. If any of this is violated, an error of type `ReplaceError`
  // is thrown.
  replace(from, to, slice) {
    return replace(this.resolve(from), this.resolve(to), slice)
  }

  // :: (number) → ?Node
  // Find the node after the given position.
  nodeAt(pos) {
    for (let node = this;;) {
      let {index, offset} = node.content.findIndex(pos)
      node = node.maybeChild(index)
      if (!node) return null
      if (offset == pos || node.isText) return node
      pos -= offset + 1
    }
  }

  // :: (number) → {node: ?Node, index: number, offset: number}
  // Find the (direct) child node after the given offset, if any,
  // and return it along with its index and offset relative to this
  // node.
  childAfter(pos) {
    let {index, offset} = this.content.findIndex(pos)
    return {node: this.content.maybeChild(index), index, offset}
  }

  // :: (number) → {node: ?Node, index: number, offset: number}
  // Find the (direct) child node before the given offset, if any,
  // and return it along with its index and offset relative to this
  // node.
  childBefore(pos) {
    if (pos == 0) return {node: null, index: 0, offset: 0}
    let {index, offset} = this.content.findIndex(pos)
    if (offset < pos) return {node: this.content.child(index), index, offset}
    let node = this.content.child(index - 1)
    return {node, index: index - 1, offset: offset - node.nodeSize}
  }

  // :: (?number, ?number, (node: Node, pos: number, parent: Node, index: number))
  // Iterate over all nodes between the given two positions, calling
  // the callback with the node, its position, its parent
  // node, and its index in that node.
  nodesBetween(from, to, f, pos = 0) {
    this.content.nodesBetween(from, to, f, pos, this)
  }

  // :: ((node: Node, pos: number, parent: Node))
  // Call the given callback for every descendant node.
  descendants(f) {
    this.nodesBetween(0, this.content.size, f)
  }

  // :: (number) → ResolvedPos
  // Resolve the given position in the document, returning an object
  // describing its path through the document.
  resolve(pos) { return ResolvedPos.resolveCached(this, pos) }

  resolveNoCache(pos) { return ResolvedPos.resolve(this, pos) }

  // :: (number) → [Mark]
  // Get the marks at the given position factoring in the surrounding marks'
  // inclusiveLeft and inclusiveRight properties. If the position is at the
  // start of a non-empty node, the marks of the node after it are returned.
  marksAt(pos) {
    let $pos = this.resolve(pos), parent = $pos.parent, index = $pos.index($pos.depth)

    // In an empty parent, return the empty array
    if (parent.content.size == 0) return emptyArray
    // When inside a text node or at the start of the parent node, return the node's marks
    if (index == 0 || !$pos.atNodeBoundary) return parent.child(index).marks

    let marks = parent.child(index - 1).marks
    for (var i = 0; i < marks.length; i++) if (!marks[i].type.inclusiveRight)
      marks = marks[i--].removeFromSet(marks)
    return marks
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
      name += "(" + this.content.toStringInner() + ")"
    return wrapMarks(this.marks, name)
  }

  contentMatchAt(index) {
    return this.type.contentExpr.getMatchAt(this.attrs, this.content, index)
  }

  allowsMarkAt(index, mark) {
    return this.contentMatchAt(index).allowsMark(mark)
  }

  findWrappingAt(index, target) {
    return this.type.findWrapping(target, this.contentMatchAt(index))
  }

  canUpdate(from, to, replacement, start, end) {
    return this.type.contentExpr.checkUpdate(this.attrs, this.content, from, to, replacement, start, end)
  }

  canUpdateWithType(from, to, type, marks) {
    return this.type.contentExpr.checkUpdateWithType(this.attrs, this.content, from, to, type, marks || emptyArray)
  }

  canAppend(other) {
    if (other.content.size) return this.canUpdate(this.childCount, this.childCount, other.content)
    else return this.type.compatibleContent(other.type)
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
}

// ;; #forward=Node
export class TextNode extends Node {
  constructor(type, attrs, content, marks) {
    super(type, attrs, null, marks)

    if (!content) throw new RangeError("Empty text nodes are not allowed")

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

  eq(other) {
    return this.sameMarkup(other) && this.text == other.text
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
