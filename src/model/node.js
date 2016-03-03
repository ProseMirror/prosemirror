import {Fragment, emptyFragment} from "./fragment"
import {Mark} from "./mark"

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
  // The size of this node. For text node, this is the amount of
  // characters. For leaf nodes, it is one. And for non-leaf nodes, it
  // is the size of the content plus two (the start and end token).
  get size() { return this.type.contains ? 2 + this.content.size : 1 }

  // :: number
  // The number of children that the node has.
  get childCount() { return this.content.childCount }

  // :: ((node: Node, pos: number))
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
    if (from == 0 && to == this.text.length) return this
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
  replaceDeep(context, node, depth = 0) {
    if (depth == context.depth) return node
    let cur = context.path[depth]
    return this.replace(cur, cur.node.replaceDeep(context, node, depth + 1))
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

  // :: (?number, ?number) → ?FragmentCursor
  // Get a cursor into this node's content.
  cursor(pos, round) {
    return this.content.cursor(pos, round)
  }

  // :: (number) → Node
  // Find the node after the given position.
  nodeAt(pos) {
    let node = this
    for (;;) {
      let cur = node.cursor(pos, -1)
      node = cur.node
      if (cur.pos == pos) return node
      pos -= cur.pos + 1
    }
  }

  // :: (number) → PosContext
  // Creates a context information object describing the path to the given position.
  context(pos) {
    let cached = PosContext.cached(this, pos)
    if (cached) return cached

    let root = this, orig = pos, path = []
    for (let node = this;;) {
      let cur = node.cursor(pos, -1)
      path.push(cur)
      if (cur.pos == pos) break
      node = cur.node
      pos -= cur.pos + 1
    }
    let cx = new PosContext(root, orig, path)
    PosContext.addToCache(this, pos, cx)
    return cx
  }

  // :: (number, number) → {from: number, to: number}
  // Finds the narrowest sibling range (two positions that both point
  // into the same node) that encloses the given positions.
  siblingRange(from, to) {
    let cxFrom = this.context(from), cxTo = this.context(to), depth = 0
    for (let d = 1, max = Math.min(cxFrom.depth, cxTo.depth); d <= max; d++) {
      if (cxFrom.parent(d) != cxTo.parent(d)) break
      depth = d
    }
    return {from: cxFrom.posAt(depth), to: cxTo.posAt(depth) + cxTo.child(depth).size}
  }

  // :: (?number, ?number, (node: Node, pos: number, parent: Node))
  // Iterate over all nodes between the given two positions, calling
  // the callback with the node, its position, and its parent
  // node. `from` and `to` may be left off, to denote
  // starting at the start of the node or ending at its end.
  nodesBetween(from, to, f, pos = 0) {
    this.content.nodesBetween(from, to, f, pos, this)
  }

  // :: (?number, ?number) → Node
  // Returns a copy of this node containing only the content between
  // `from` and `to`. You can omit either argument to start
  // or end at the start or end of the node.
  slice(from, to) {
    return this.copy(this.content.slice(from, to))
  }

  // :: (number) → [Mark]
  // Get the marks of the node before the given position or, if that
  // position is at the start of a non-empty node, those of the node
  // after it.
  marksAt(pos) {
    let cx = this.context(pos), top = cx.path[cx.path.length - 1]
    let leaf = top.nodeBeforeOrAround
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
  Node.prototype[Symbol.iterator] = function() { return this.cursor() }
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

  get size() { return this.text.length }

  mark(marks) {
    return new TextNode(this.type, this.attrs, this.text, marks)
  }

  slice(from = 0, to = this.text.length) {
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

class PosContext {
  constructor(root, pos, path) {
    this.root = root
    this.pos = pos
    this.path = path
  }

  parent(level = this.depth) {
    return level ? this.root : this.path[level - 1].node
  }

  child(level = this.depth) {
    return this.path[level].node
  }

  offset(level = this.depth) {
    return this.path[level].pos
  }

  posAt(level = this.depth) {
    let pos = 0
    for (let i = 0; i < level; i++)
      pos += this.path[level].pos + (i ? 1 : 0)
    return pos
  }

  get depth() {
    return this.path.length - 1
  }

  static cached(doc, pos) {
    for (let i = 0; i < cachedDoc.length; i++)
      if (cachedDoc[i] = doc && cachedPos[i] == pos) return cachedCx[i]
  }

  static addToCache(doc, pos, cx) {
    cachedDoc[cachePos] = doc
    cachedPos[cachePos] = pos
    cachedCx[cachePos] = cx
    cachePos = (cachePos + 1) % cacheMax
  }
}

let cachedDoc = [], cachedPos = [], cachedCx = [], cachePos = 0, cacheMax = 5
