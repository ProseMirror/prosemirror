import {Fragment, emptyFragment} from "./fragment"
import {Mark} from "./mark"
import {ProseMirrorError} from "../util/error"
import {ModelError} from "./error"

export class ReplaceError extends ProseMirrorError {}

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
    if (from == to) return new Slice(emptyFragment, 0, 0)

    from = getContext(this, from)
    to = getContext(this, to)
    let depth = from.sameDepth(to), start = from.start(depth)
    let content = from.node[depth].content.cut(from.pos - start, to.pos - start)
    return new Slice(content, from.depth - depth, to.depth - depth)
  }

  replace(from, to, slice) {
    from = getContext(this, from)
    to = getContext(this, to)
    if (to.depth - slice.openLeft != from.depth - slice.openRight)
      throw new ReplaceError("Inconsistent open depths")
    return replaceOuter(this, from, to, slice, 0)
  }

  // :: (number) → Node
  // Find the node after the given position.
  nodeAt(pos) {
    for (let node = this;;) {
      let index = findIndex(node.content, pos)
      node = node.child(index)
      if (foundPos == pos || node.isText) return node
      pos -= foundPos + 1
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

  context(pos) {
    return PosContext.resolve(this, pos)
  }

  // :: (number) → [Mark]
  // Get the marks of the node before the given position or, if that
  // position is at the start of a non-empty node, those of the node
  // after it.
  marksAt(pos) {
    let cx = this.context(pos), top = cx.parent, index = cx.index[cx.depth]
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
    if (this.size)
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

  get size() { return this.text.length }

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

let foundPos = 0
function findIndex(fragment, pos, round = -1) {
  if (pos == 0) { foundPos = pos; return 0 }
  if (pos == fragment.size) { foundPos = pos; return fragment.content.length }
  if (pos > fragment.size || pos < 0) throw new ModelError(`Position ${pos} outside of fragment (${fragment})`)
  for (let i = 0, curPos = 0;; i++) {
    let cur = fragment.content[i], end = curPos + cur.size
    if (end >= pos) {
      if (end == pos || round > 0) { foundPos = end; return i + 1 }
      foundPos = curPos; return i
    }
    curPos = end
  }
}

class PosContext {
  constructor(pos, node, index, offset) {
    this.pos = pos
    this.node = node
    this.index = index
    this.offset = offset
  }

  get innerOffset() { return this.offset[this.depth] }

  get parent() { return this.node[this.depth] }

  get depth() { return this.node.length - 1 }

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
    let index = this.index.slice(), offset = this.offset.slice()
    index[this.depth] = findIndex(this.parent.content, this.innerOffset + diff)
    offset[this.depth] = foundPos
    return new PosContext(pos, this.node, index, offset)
  }

  static resolve(doc, pos) {
    let nodes = [], index = [], offset = []
    for (let rem = pos, node = doc;;) {
      let i = findIndex(node.content, rem)
      rem -= foundPos
      let next = rem && node.child(i)
      nodes.push(node)
      offset.push(foundPos + (next.isText ? rem : 0))
      index.push(i)
      if (!rem || next.isText) break
      node = next
      rem -= 1
    }
    return new PosContext(pos, nodes, index, offset)
  }
}

class Slice {
  constructor(content, openLeft, openRight) {
    this.content = content
    this.openLeft = openLeft
    this.openRight = openRight
  }

  toJSON() {
    if (!this.content.size) return null
    return {content: this.content.toJSON(),
            openLeft: this.openLeft,
            openRight: this.openRight}
  }

  static fromJSON(schema, json) {
    if (!json) return new Slice(emptyFragment, 0, 0)
    return new Slice(Fragment.fromJSON(schema, json.content), json.openLeft, json.openRight)
  }
}

let contextCache = [], contextCachePos = 0, contextCacheSize = 6
function getContext(doc, pos) {
  let near = null
  for (let i = 0; i < contextCache.length; i++) {
    let cached = contextCache[i]
    if (cached.node[0] == doc) {
      if (cached.pos == pos) return cached
      let start = cached.start()
      if (cached.depth && pos > start && pos < start + cached.parent.content.size)
        near = cached
    }
  }
  let result = near ? near.move(pos) : PosContext.resolve(doc, pos)
  contextCache[contextCachePos] = result
  contextCachePos = (contextCachePos + 1) % contextCacheSize
  return result    
}


function replaceOuter(from, to, slice, depth) {
  let index = from.index[depth], node = from.node[depth]
  if (index == to.index[depth] && depth < from.depth - slice.openFrom) {
    let inner = replaceOuter(from, to, slice, depth + 1)
    return node.copy(node.content.replace(index, inner))
  } else if (slice.content.size) {
    let {left, right} = prepareSliceForReplace(slice, from)
    return node.copy(replaceThreeWay(from, left, right, to, depth))
  } else {
    return node.copy(replaceTwoWay(from, to, depth))
  }
}

function checkJoin(before, after) {
  let main = before, sub = after
  if (!before.content.size && after.content.size) { sub = before; main = after }
  if (!main.type.canContainContent(sub.type))
    throw new ReplaceError("Can not join " + sub.type.name + " onto " + main.type.name)
  return main
}

function replaceThreeWay(from, start, end, to, depth) {
  let openLeft = from.depth > depth && checkJoin(from.node[depth + 1], start.node[depth + 1])
  let openRight = to.depth > depth && checkJoin(end.node[depth + 1], to.node[depth + 1])

  let content = from.node[depth].content.toArray(0, from.offset[depth])
  if (openLeft && openRight && start.index[depth] == end.index[depth]) {
    let type = checkJoin(openLeft, openRight)
    let joined = replaceThreeWay(from, start, end, to, depth + 1)
    content.push(type.type.close(type.attrs, joined))
  } else {
    if (openLeft)
      content.push(openLeft.type.close(openLeft.attrs, replaceTwoWay(from, start, depth + 1)))
    let between = start.node[depth].content.toArray(start.offset[depth], end.offset[depth])
    for (let i = 0; i < between.length; i++) content.push(between[i])
    if (openRight)
      content.push(openRight.type.close(openRight.attrs, replaceTwoWay(end, to, depth + 1)))
  }
  let after = to.node[depth].content.toArray(to.offset[depth])
  for (let i = 0; i < after.length; i++) content.push(after[i])
  return Fragment.fromArray(content)
}

function replaceTwoWay(from, to, depth) {
  let content = from.node[depth].content.toArray(0, from.offset[depth])
  if (from.depth > depth) {
    let type = checkJoin(from.node[depth + 1], to.node[depth + 1])
    content.push(type.type.close(type.attrs, replaceTwoWay(from, to, depth + 1)))
  }
  let after = to.node[depth].content.toArray(to.offset[depth])
  for (let i = 0; i < after.length; i++) content.push(after[i])
  return Fragment.fromArray(content)
}

function prepareSliceForReplace(slice, along) {
  let extra = along.depth - slice.openLeft, parent = along.node[extra]
  if (!parent.type.canContainFragment(slice.content))
    throw new ReplaceError("Content " + slice + " can not be placed in " + parent.type.name)
  let node = parent.copy(slice.content)
  // FIXME only copy up to start depth? rest won't be used
  for (let i = extra - 1; i >= 0; i--)
    node = along.node[i].copy(Fragment.from(node))
  return {start: PosContext.resolve(node, slice.openLeft + extra),
          end: PosContext.resolve(node, node.size - slice.openRight - extra)}
}
