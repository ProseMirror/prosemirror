import {sameStyles} from "./style"

const emptyArray = []

/**
 * Document node class
 */
export class Node {
  constructor(type, attrs) {
    this.type = type
    this.attrs = attrs
  }

  sameMarkup(other) {
    return compareMarkup(this.type, other.type, this.attrs, other.attrs)
  }

  child(_) {
    throw new Error("Trying to index non-block node " + this)
  }
  get length() { return 0 }

  toJSON() {
    let obj = {type: this.type.name}
    for (let _ in this.attrs) {
      obj.attrs = this.attrs
      return obj
    }
    return obj
  }

  get isBlock() { return false }
  get isTextblock() { return false }
  get isInline() { return false }
  get isText() { return false }
}

export class BlockNode extends Node {
  constructor(type, attrs, content, styles) {
    if (styles) throw new Error("Constructing a block node with styles")
    super(type, attrs)
    this.content = content || emptyArray
  }

  toString() {
    return this.type.name + "(" + this.content.join(", ") + ")"
  }

  copy(content = null) {
    return new this.constructor(this.type, this.attrs, content)
  }

  slice(from, to = this.length) {
    return this.content.slice(from, to)
  }

  // FIXME maybe slice and splice returning different things is going to confuse
  splice(from, to, replace) {
    return new this.constructor(this.type, this.attrs, this.content.slice(0, from).concat(replace).concat(this.content.slice(to)))
  }

  replace(pos, node) {
    let content = this.content.slice()
    content[pos] = node
    return this.copy(content)
  }

  replaceDeep(path, node, depth = 0) {
    if (depth == path.length) return node
    let pos = path[depth]
    return this.replace(pos, this.child(pos).replaceDeep(path, node, depth + 1))
  }

  append(nodes, joinLeft = 0, joinRight = 0) {
    if (!nodes.length) return this
    if (!this.length) return this.copy(nodes)

    let last = this.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = nodes[0]
    if (joinLeft > 0 && joinRight > 0 && before.sameMarkup(after))
      content.push(before.append(after.content, joinLeft - 1, joinRight - 1))
    else
      content.push(before.close(joinLeft - 1, "end"), after.close(joinRight - 1, "start"))
    for (let i = 1; i < nodes.length; i++) content.push(nodes[i])
    return this.copy(content)
  }

  close(depth, side) {
    if (depth == 0 && this.length == 0 && !this.type.canBeEmpty)
      return this.copy(this.type.defaultContent())
    if (depth < 0) return this
    let off = side == "start" ? 0 : this.maxOffset - 1, child = this.child(off)
    let closed = child.close(depth - 1, side)
    if (closed == child) return this
    return this.replace(off, closed)
  }

  get maxOffset() { return this.length }

  get textContent() {
    let text = ""
    for (let i = 0; i < this.length; i++)
      text += this.child(i).textContent
    return text
  }

  /**
   * Get the child node at a given index.
   */
  child(i) {
    if (i < 0 || i >= this.length)
      throw new Error("Index " + i + " out of range in " + this)
    return this.content[i]
  }

  get firstChild() { return this.content[0] || null }
  get lastChild() { return this.content[this.length - 1] || null }

  get length() { return this.content.length }

  get children() { return this.content }

  /**
   * Get a child node given a path.
   *
   * @param  {array} path
   * @return {Node}
   */
  path(path) {
    for (var i = 0, node = this; i < path.length; node = node.content[path[i]], i++) {}
    return node
  }

  isValidPos(pos, requireInBlock) {
    for (let i = 0, node = this;; i++) {
      if (i == pos.path.length) {
        if (requireInBlock && !node.isTextblock) return false
        return pos.offset <= node.maxOffset
      } else {
        let n = pos.path[i]
        if (n >= node.length || node.isTextblock) return false
        node = node.child(n)
      }
    }
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

  toJSON() {
    let obj = super.toJSON()
    obj.content = this.content.map(n => n.toJSON())
    return obj
  }

  get isBlock() { return true }

  nodesBetween(from, to, f, path = [], parent = null) {
    if (f(this, path, from, to, parent) === false) return

    let start, endPartial = to && to.depth > path.length
    let end = endPartial ? to.path[path.length] : to ? to.offset : this.length
    if (!from) {
      start = 0
    } else if (from.depth == path.length) {
      start = from.offset
    } else {
      start = from.path[path.length] + 1
      let passTo = null
      if (endPartial && end == start - 1) {
        passTo = to
        endPartial = false
      }
      this.enterNode(start - 1, from, passTo, path, f)
    }
    for (let i = start; i < end; i++)
      this.enterNode(i, null, null, path, f)
    if (endPartial)
      this.enterNode(end, null, to, path, f)
  }

  enterNode(index, from, to, path, f) {
    path.push(index)
    this.child(index).nodesBetween(from, to, f, path, this)
    path.pop()
  }

  inlineNodesBetween(from, to, f) {
    this.nodesBetween(from, to, (node, path, from, to, parent, offset) => {
      if (node.isInline)
        f(node, from ? from.offset : offset, to ? to.offset : offset + node.offset, path, parent)
    })
  }
}

export class TextblockNode extends BlockNode {
  constructor(type, attrs, content) {
    super(type, attrs, content)
    let maxOffset = 0
    for (let i = 0; i < this.content.length; i++) maxOffset += this.content[i].offset
    this._maxOffset = maxOffset
  }

  slice(from, to = this.maxOffset) {
    let result = []
    if (from == to) return result
    for (let i = 0, offset = 0;; i++) {
      let child = this.child(i), size = child.offset, end = offset + size
      if (offset + size > from)
        result.push(offset >= from && end <= to ? child : child.slice(Math.max(0, from - offset),
                                                                      Math.min(size, to - offset)))
      if (end >= to) return result
      offset = end
    }
  }

  append(nodes) {
    if (!nodes.length) return this
    if (!this.length) return this.copy(nodes)

    let content = this.content.concat(nodes), last = this.length - 1, merged
    if (merged = content[last].maybeMerge(content[last + 1]))
      content.splice(last, 2, merged)
    return this.copy(content)
  }

  close() {
    return this
  }

  get isTextblock() { return true }

  get maxOffset() { return this._maxOffset }

  nodesBetween(from, to, f, path, parent) {
    if (f(this, path, from, to, parent) === false) return
    let start = from ? from.offset : 0, end = to ? to.offset : this.maxOffset
    if (start == end) return
    for (let offset = 0, i = 0; i < this.length; i++) {
      let child = this.child(i), endOffset = offset + child.offset
      if (endOffset >= start)
        f(child, path, offset < start ? from : null, endOffset > end ? to : null, this, offset)
      if (endOffset >= end) break
      offset = endOffset
    }
  }

  childBefore(offset) {
    if (offset == 0) return {node: null, index: 0, innerOffset: 0}
    for (let i = 0; i < this.length; i++) {
      let child = this.child(i)
      offset -= child.offset
      if (offset <= 0) return {node: child, index: i, innerOffset: offset + child.offset}
    }
  }

  childAfter(offset) {
    for (let i = 0; i < this.length; i++) {
      let child = this.child(i), size = child.offset
      if (offset < size) return {node: child, index: i, innerOffset: offset}
      offset -= size
    }
    return {node: null, index: 0, innerOffset: 0}
  }
}

export class InlineNode extends Node {
  constructor(type, attrs, content, styles) {
    if (content) throw new Error("Can't create a span node with content")
    super(type, attrs)
    this.styles = styles || emptyArray
  }

  get offset() { return 1 }

  get textContent() { return "" }

  styled(styles) {
    return new this.constructor(this.type, this.attrs, this.text, styles)
  }

  maybeMerge(_) { return null }

  toJSON() {
    let obj = super.toJSON()
    if (this.styles.length) obj.styles = this.styles.map(s => s.toJSON())
    return obj
  }

  toString() { return this.type.name }

  get isInline() { return true }
}

export class TextNode extends InlineNode {
  constructor(type, attrs, content, styles) {
    if (typeof content != "string" || !content)
      throw new Error("Text node content must be a non-empty string")
    super(type, attrs, null, styles)
    this.text = content
  }

  get offset() { return this.text.length }

  get textContent() { return this.text }

  maybeMerge(other) {
    if (other.type == this.type && sameStyles(this.styles, other.styles))
      return new TextNode(this.type, this.attrs, this.text + other.text, this.styles)
  }

  slice(from, to = this.offset) {
    return new TextNode(this.type, this.attrs, this.text.slice(from, to), this.styles)
  }

  toString() {
    let text = JSON.stringify(this.text)
    for (let i = 0; i < this.styles.length; i++)
      text = this.styles[i].type.name + "(" + text + ")"
    return text
  }

  toJSON() {
    let obj = super.toJSON()
    obj.text = this.text
    return obj
  }

  get isText() { return true }
}

function isEmpty(obj) {
  if (obj) for (let _ in obj) return false
  return true
}

export function compareMarkup(typeA, typeB, attrsA, attrsB) {
  if (typeA != typeB) return false
  if (isEmpty(attrsA)) return isEmpty(attrsB)
  if (isEmpty(attrsB)) return false
  for (var prop in attrsA)
    if (attrsB[prop] !== attrsA[prop])
      return false
  return true
}
