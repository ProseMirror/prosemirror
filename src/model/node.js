import * as style from "./style"

export class Node {
  constructor(type, attrs, content) {
    this.type = type
    this.attrs = attrs
    this.content = content || (type.contains ? [] : Node.empty)
  }

  toString() {
    if (this.type.contains)
      return this.type.name + "(" + this.content.join(", ") + ")"
    else
      return this.type.name
  }

  copy(content = null) {
    return new Node(this.type, this.attrs, content)
  }

  slice(from, to = this.maxOffset) {
    if (from == to) return []
    if (!this.type.block) return this.content.slice(from, to)
    let result = []
    for (let i = 0, offset = 0;; i++) {
      let child = this.content[i], size = child.size, end = offset + size
      if (offset + size > from)
        result.push(offset >= from && end <= to ? child : child.slice(Math.max(0, from - offset),
                                                                      Math.min(size, to - offset)))
      if (end >= to) return result
      offset = end
    }
  }

  splice(from, to, replace) {
    return new Node(this.type, this.attrs, this.content.slice(0, from).concat(replace).concat(this.content.slice(to)))
  }

  replace(pos, node) {
    let content = this.content.slice()
    content[pos] = node
    return this.copy(content)
  }

  replaceDeep(path, node, depth = 0) {
    if (depth == path.length) return node
    let pos = path[depth]
    return this.replace(pos, this.content[pos].replaceDeep(path, node, depth + 1))
  }

  append(nodes, joinDepth = 0) {
    if (!nodes.length) return this
    if (!this.content.length) return this.copy(nodes)

    if (this.type.block) {
      let content = this.content.concat(nodes), last = this.content.length - 1, merged
      if (merged = this.content[last].maybeMerge(nodes[0]))
        content.splice(last, 2, merged)
      return this.copy(content)
    }

    let last = this.content.length - 1, content = this.content.slice(0, last)
    let before = this.content[last], after = nodes[0]
    if (joinDepth && before.sameMarkup(after)) {
      content.push(before.append(after.content, joinDepth - 1))
    } else {
      content.push(before, after)
    }
    for (let i = 1; i < nodes.length; i++) content.push(nodes[i])
    return this.copy(content)
  }

  get size() {
    let sum = 0
    for (let i = 0; i < this.content.length; i++)
      sum += this.content[i].size
    return sum
  }

  get maxOffset() {
    return this.type.block ? this.size : this.content.length
  }

  get textContent() {
    let text = ""
    for (let i = 0; i < this.content.length; i++)
      text += this.content[i].textContent
    return text
  }

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
        if (n >= node.content.length || node.type.block) return false
        node = node.content[n]
      }
    }
  }

  pathNodes(path) {
    let nodes = []
    for (var i = 0, node = this;; i++) {
      nodes.push(node)
      if (i == path.length) break
      node = node.content[path[i]]
    }
    return nodes
  }

  static compareMarkup(typeA, typeB, attrsA, attrsB) {
    if (typeA != typeB) return false
    for (var prop in attrsA)
      if (attrsB[prop] !== attrsA[prop])
        return false
    return true
  }

  sameMarkup(other) {
    return Node.compareMarkup(this.type, other.type, this.attrs, other.attrs)
  }

  toJSON() {
    let obj = {type: this.type.name}
    if (this.content.length) obj.content = this.content.map(n => n.toJSON())
    if (this.attrs != nullAttrs) obj.attrs = this.attrs
    return obj
  }

  static fromJSON(json) {
    let type = nodeTypes[json.type]
    if (type.type == "span")
      return Span.fromJSON(type, json)
    else
      return new Node(type, maybeNull(json.attrs),
                      json.content ? json.content.map(n => Node.fromJSON(n)) : Node.empty)
  }
}

Node.empty = [] // Reused empty array for collections that are guaranteed to remain empty

function maybeNull(obj) {
  if (!obj) return nullAttrs
  for (let _prop in obj) return obj
  return nullAttrs
}

export class Span extends Node {
  constructor(type, attrs, text, styles) {
    super(type, attrs)
    this.text = text == null ? "×" : text
    this.styles = styles || Node.empty
  }

  toString() {
    if (this.type == nodeTypes.text) {
      let text = JSON.stringify(this.text)
      for (let i = 0; i < this.styles.length; i++)
        text = this.styles[i].type + "(" + text + ")"
      return text
    } else {
      return super.toString()
    }
  }

  slice(from, to = this.text.length) {
    return new Span(this.type, this.attrs, this.text.slice(from, to), this.styles)
  }

  copy() {
    throw new Error("Can't copy span nodes like this!")
  }

  get size() {
    return this.text.length
  }

  get textContent() {
    return this.text
  }

  styled(styles) {
    return new Span(this.type, this.attrs, this.text, styles)
  }

  maybeMerge(other) {
    if (other.type == this.type && this.type == nodeTypes.text &&
        style.sameSet(this.styles, other.styles))
      return $text(this.text + other.text, this.styles)
  }

  toJSON() {
    let obj = {type: this.type.name}
    if (this.attrs != nullAttrs) obj.attrs = this.attrs
    if (this.text != "×") obj.text = this.text
    if (this.styles.length) obj.styles = this.styles
    return obj
  }

  static fromJSON(type, json) {
    return new Span(type, maybeNull(json.attrs), json.text || "×", json.styles || Node.empty)
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

  return new (type.type == "span" ? Span : Node)(type, attrs, content, styles)
}
export function $text(text, styles) {
  return new Span(nodeTypes.text, null, text, styles)
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
