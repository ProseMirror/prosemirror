import * as style from "./style"

const emptyArray = []

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
}

export class BlockNode extends Node {
  constructor(type, attrs, content, styles) {
    if (styles) throw new Error("Constructing a block node with styles")
    super(type, attrs)
    this.content = content || (type.contains ? [] : emptyArray)
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

  append(nodes, joinDepth = 0) {
    if (!nodes.length) return this
    if (!this.length) return this.copy(nodes)

    let last = this.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = nodes[0]
    if (joinDepth && before.sameMarkup(after)) {
      content.push(before.append(after.content, joinDepth - 1))
    } else {
      content.push(before, after)
    }
    for (let i = 1; i < nodes.length; i++) content.push(nodes[i])
    return this.copy(content)
  }

  get maxOffset() { return this.length }

  get textContent() {
    let text = ""
    for (let i = 0; i < this.length; i++)
      text += this.child(i).textContent
    return text
  }

  child(i) {
    if (i < 0 || i > this.length)
      throw new Error("Index " + i + " out of range in " + this)
    return this.content[i]
  }

  get firstChild() { return this.content[0] || null }
  get lastChild() { return this.content[this.length - 1] || null }

  get length() { return this.content.length }

  get children() { return this.content }

  path(path) {
    for (var i = 0, node = this; i < path.length; node = node.content[path[i]], i++) {}
    return node
  }

  isValidPos(pos, requireInBlock) {
    for (let i = 0, node = this;; i++) {
      if (i == pos.path.length) {
        if (requireInBlock && !node.type.block) return false
        return pos.offset <= node.maxOffset
      } else {
        let n = pos.path[i]
        if (n >= node.length || node.type.block) return false
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
}

class TextblockNode extends BlockNode {
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

  get maxOffset() {
    let sum = 0
    for (let i = 0; i < this.length; i++) sum += this.child(i).offset
    return sum
  }
}

export class SpanNode extends Node {
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
    if (this.styles.length) obj.styles = this.styles
    return obj
  }
}

class TextNode extends SpanNode {
  constructor(type, attrs, content, styles) {
    if (typeof content != "string") throw new Error("Passing non-string as text node content")
    super(type, attrs, null, styles)
    this.text = content
  }

  get offset() { return this.text.length }

  get textContent() { return this.text }

  maybeMerge(other) {
    if (other.type == this.type && style.sameSet(this.styles, other.styles))
      return $text(this.text + other.text, this.styles)
  }

  slice(from, to = this.offset) {
    return new TextNode(this.type, this.attrs, this.text.slice(from, to), this.styles)
  }

  toJSON() {
    let obj = super.toJSON()
    obj.text = this.text
    return obj
  }
}

const nullAttrs = Node.nullAttrs = {}

export class NodeType {
  constructor(options) {
    this.name = options.name
    this.type = options.type
    this.contains = options.contains
    this.block = this.contains == "span"
    this.defaultAttrs = options.defaultAttrs
    if (this.defaultAttrs == null) this.defaultAttrs = nullAttrs
    this.plainText = !!options.plainText
  }
}

export const nodeTypes = {
  doc: new NodeType({type: "doc", contains: "element"}),
  paragraph: new NodeType({type: "element", contains: "span"}),
  blockquote: new NodeType({type: "element", contains: "element"}),
  heading: new NodeType({type: "element", contains: "span", defaultAttrs: false}),
  bullet_list: new NodeType({type: "element", contains: "list_item", defaultAttrs: {bullet: "*", tight: true}}),
  ordered_list: new NodeType({type: "element", contains: "list_item", defaultAttrs: {order: 1, tight: true}}),
  list_item: new NodeType({type: "list_item", contains: "element"}),
  html_block: new NodeType({type: "element", defaultAttrs: false}),
  code_block: new NodeType({type: "element", contains: "span", defaultAttrs: {params: null}, plainText: true}),
  horizontal_rule: new NodeType({type: "element"}),
  text: new NodeType({type: "span"}),
  image: new NodeType({type: "span", defaultAttrs: false}),
  hard_break: new NodeType({type: "span"}),
  html_tag: new NodeType({type: "span", defaultAttrs: false})
}

for (let name in nodeTypes) nodeTypes[name].name = name

export function $node(type, attrs, content, styles) {
  if (typeof type == "string") {
    let found = nodeTypes[type]
    if (!found) throw new Error("Unknown node type: " + type)
    type = found
  }
  if (!(type instanceof NodeType)) throw new Error("Invalid node type: " + type)
  if (!attrs && !(attrs = type.defaultAttrs))
    throw new Error("No default attributes for node type " + type.name)

  let ctor = type.name == "text" ? TextNode
           : type.type == "span" ? SpanNode
           : type.block ? TextblockNode
           : BlockNode
  return new ctor(type, attrs, content, styles)
}

export function $text(text, styles) {
  return new TextNode(nodeTypes.text, null, text, styles)
}

function maybeNull(obj) {
  if (!obj) return nullAttrs
  for (let _prop in obj) return obj
  return nullAttrs
}

export function $fromJSON(json) {
  let type = nodeTypes[json.type]
  if (!type) throw new Error("Unknown node type: " + json.type)
  let attrs = maybeNull(json.attrs)
  if (type.name == "text") return new TextNode(type, attrs, json.text, json.styles || emptyArray)
  if (type.type == "span") return new SpanNode(type, attrs, null, json.styles || emptyArray)

  let content = json.content ? json.content.map($fromJSON) : emptyArray
  if (type.block) return new TextblockNode(type, attrs, content)
  return new BlockNode(type, attrs, content)
}

export function findConnection(from, to) {
  if (from.contains == to.type) return []

  let seen = Object.create(null)
  let active = [{from: from, via: []}]
  while (active.length) {
    let current = active.shift()
    for (let name in nodeTypes) {
      let type = nodeTypes[name]
      if (current.from.contains == type.type && !(type.contains in seen)) {
        let via = current.via.concat(type)
        if (type.contains == to.type) return via
        active.push({from: type, via: via})
        seen[type.contains] = true
      }
    }
  }
}

export function compareMarkup(typeA, typeB, attrsA, attrsB) {
  if (typeA != typeB) return false
  for (var prop in attrsA)
    if (attrsB[prop] !== attrsA[prop])
      return false
  return true
}
