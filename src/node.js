export default class Node {
  constructor(type, content, attrs = nullAttrs) {
    if (typeof type == "string") type = nodeTypes[type]
    if (!type) throw new Error("Node without type")
    this.type = type
    this.content = content || (type.contains ? [] : null)
    this.attrs = attrs
  }

  toString() {
    if (this.type.contains)
      return this.type.name + "(" + this.content.join(", ") + ")"
    else
      return this.type.name
  }
}

const nullAttrs = Node.nullAttrs = {}
const nullStyles = []

class InlineNode extends Node {
  constructor(type, styles, text, attrs = nullAttrs) {
    super(type, null, attrs)
    this.text = text || "×"
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
}

Node.InlineNode = InlineNode

class NodeType {
  constructor(type, contains, attrs = nullAttrs) {
    this.name = ""
    this.type = type
    this.contains = contains
    this.attrs = attrs
  }
}

const nodeTypes = Node.types = {
  doc: new NodeType("doc", "block"),
  blockquote: new NodeType("block", "block"),
  paragraph: new NodeType("block", "inline"),
  heading: new NodeType("block", "inline", {level: null}),
  bullet_list: new NodeType("block", "list_item", {bullet: "str", tight: "bool"}),
  ordered_list: new NodeType("block", "list_item", {order: "num", tight: "bool"}),
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

class InlineStyle {
  constructor(type, attrs = nullAttrs) {
    this.type = type
    this.attrs = attrs
  }
}

const styles = Node.styles = {
  code: new InlineStyle("code"),
  em: new InlineStyle("em"),
  strong: new InlineStyle("strong"),
  link: (href, title) => new InlineStyle("link", {href: href, title: title})
}
