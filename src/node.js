const nullContent = []

export default class Node {
  constructor(type, content, attrs = nullAttrs) {
    if (typeof type == "string") type = nodeTypes[type]
    if (!type) throw new Error("Node without type")
    this.type = type
    this.content = content || (type.contains ? [] : nullContent)
    this.attrs = attrs
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
}

const nullAttrs = Node.nullAttrs = {}
const nullStyles = []

class InlineNode extends Node {
  constructor(type, styles, text, attrs = nullAttrs) {
    super(type, null, attrs)
    this.text = text == null ? "×" : text
    this.styles = styles || nullStyles
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
}

Node.Inline = InlineNode

class NodeType {
  constructor(type, contains, attrs = nullAttrs, defaultAttrs = nullAttrs) {
    this.name = ""
    this.type = type
    this.contains = contains
    this.attrs = attrs
    this.defaultAttrs = defaultAttrs
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
  code_block: new NodeType("block", "inline", {params: "str"}),
  horizontal_rule: new NodeType("block", null, {markup: "str"}),
  text: new NodeType("inline", null, {text: "str", style: "arr"}),
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
