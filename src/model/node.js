export default class Node {
  constructor(type, content, attrs = null) {
    if (typeof type == "string") {
      let found = nodeTypes[type]
      if (!found) throw new Error("Unknown node type: " + type)
      type = found
    }
    if (!(type instanceof NodeType)) throw new Error("Invalid node type: " + type)
    this.type = type
    this.content = content || (type.contains ? [] : Node.empty)
    if (!attrs && !(attrs = type.defaultAttrs))
      throw new Error("No default attributes for node type " + type.name)
    this.attrs = attrs || type.defaultAttrs
  }

  toString() {
    // FIXME join adjacent inline styles when possible
    if (this.type.contains)
      return this.type.name + "(" + this.content.join(", ") + ")"
    else
      return this.type.name
  }

  copy(content = null) {
    return new Node(this.type, content, this.attrs)
  }

  push(child) {
    if (this.type.contains != child.type.type)
      throw new Error("Can't insert " + child.type.name + " into " + this.type.name)
    this.content.push(child)
  }

  pushFrom(other, start = 0, end = other.content.length) {
    for (let i = start; i < end; i++)
      this.push(other.content[i])
  }

  remove(child) {
    let found = this.content.indexOf(child)
    if (found == -1) throw new Error("Child not found")
    this.content.splice(found, 1)
  }

  get size() {
    let sum = 0
    for (let i = 0; i < this.content.length; i++)
      sum += this.content[i].size
    return sum
  }

  get maxOffset() {
    return this.type.contains == "inline" ? this.size : this.content.length
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
    return {type: this.type.name,
            content: this.content.length ? this.content.map(n => n.toJSON()) : this.content,
            attrs: this.attrs}
  }

  static fromJSON(json) {
    if (json.styles)
      return new InlineNode(json.type, maybeEmpty(json.styles), json.text, maybeNull(json.attrs))
    else
      return new Node(json.type, maybeEmpty(json.content.map(n => Node.fromJSON(n))), maybeNull(json.attrs))
  }
}

Node.empty = [] // Reused empty array for collections that are guaranteed to remain empty

function maybeNull(obj) {
  for (let _prop in obj) return obj
  return nullAttrs
}

function maybeEmpty(arr) { return arr.length ? arr : Node.empty }

class InlineNode extends Node {
  constructor(type, styles, text, attrs = null) {
    super(type, null, attrs)
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
    return new InlineNode(this.type, this.styles, this.text.slice(from, to), this.attrs)
  }

  copy() {
    throw new Error("Can't copy inline nodes like this!")
  }

  get size() {
    return this.text.length
  }

  get textContent() {
    return this.text
  }

  toJSON() {
    let obj = super.toJSON()
    obj.text = this.text
    obj.styles = this.styles
    return obj
  }
}

Node.Inline = InlineNode

Node.text = (text, styles) => new InlineNode(nodeTypes.text, styles, text)

const nullAttrs = Node.nullAttrs = {}

class NodeType {
  constructor(type, contains, attrs = nullAttrs, defaultAttrs = null) {
    this.name = ""
    this.type = type
    this.contains = contains
    this.attrs = attrs
    this.defaultAttrs = defaultAttrs || (attrs == nullAttrs && nullAttrs)
  }
}

const nodeTypes = Node.types = {
  doc: new NodeType("doc", "block"),
  paragraph: new NodeType("block", "inline"),
  blockquote: new NodeType("block", "block"),
  heading: new NodeType("block", "inline", {level: null}),
  bullet_list: new NodeType("block", "list_item", {bullet: "str", tight: "bool"}, {bullet: "*", tight: true}),
  ordered_list: new NodeType("block", "list_item", {order: "num", tight: "bool"}, {order: 1, tight: true}),
  list_item: new NodeType("list_item", "block"),
  html_block: new NodeType("block", null, {html: "str"}),
  code_block: new NodeType("block", "inline", {params: "str"}, {params: null}),
  horizontal_rule: new NodeType("block", null),
  text: new NodeType("inline", null),
  image: new NodeType("inline", null, {src: "str", title: "str", alt: "str"}),
  hard_break: new NodeType("inline", null),
  html_tag: new NodeType("inline", null, {html: "str"})
}

for (let name in nodeTypes) nodeTypes[name].name = name

Node.findConnection = function(from, to) {
  if (from.contains == to.type) return []

  let seen = Object.create(null)
  let active = [{from: from, via: []}]
  while (active.length) {
    let current = active.shift()
    for (let name in Node.types) {
      let type = Node.types[name]
      if (current.from.contains == type.type && !(type.contains in seen)) {
        let via = current.via.concat(type)
        if (type.contains == to.type) return via
        active.push({from: type, via: via})
        seen[type.contains] = true
      }
    }
  }
}
