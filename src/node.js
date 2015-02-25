/* @flow */

var nullContent = []

class Node {
  type: NodeType;
  content: Array<Node>;
  attrs: any;

  constructor(type: string | NodeType, content: ?Array<Node> = null, attrs: any = nullAttrs) {
    if (typeof type == "string") type = nodeTypes[type]
    if (!type) throw new Error("Node without type")
    this.type = type
    this.content = content || (type.contains ? [] : nullContent)
    this.attrs = attrs
  }

  toString(): string {
    if (this.type.contains)
      return this.type.name + "(" + this.content.join(", ") + ")"
    else
      return this.type.name
  }
}

module.exports = Node

var nullStyles = []

class InlineNode extends Node {
  text: string;
  styles: Array<InlineStyle>;

  constructor(type: string | NodeType, styles: Array<InlineStyle> = nullStyles,
              text: ?string, attrs: any = nullAttrs) {
    super(type, null, attrs)
    this.text = text || "×"
    this.styles = styles
  }

  toString(): string {
    if (this.type == nodeTypes.text) {
      var text = JSON.stringify(this.text)
      for (var i = 0; i < this.styles.length; i++)
        text = this.styles[i].type + "(" + text + ")"
      return text
    } else {
      return super.toString()
    }
  }
}

Node.InlineNode = InlineNode

var nullAttrs = Node.nullAttrs = {}

class NodeType {
  name: string;
  type: string;
  contains: ?string;
  attrs: any;

  constructor(type: string, contains: ?string, attrs: any = nullAttrs) {
    this.name = ""
    this.type = type
    this.contains = contains
    this.attrs = attrs
  }
}

Node.NodeType = NodeType

var nodeTypes: {[key:string]: NodeType} = Node.types = {
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

for (var name in nodeTypes) nodeTypes[name].name = name

class InlineStyle {
  type: string;
  attrs: any;

  constructor(type: string, attrs: any = nullAttrs) {
    this.type = type
    this.attrs = attrs
  }
}

Node.InlineStyle = InlineStyle

var styles: {[key:string]: InlineStyle} = Node.styles = {
  code: new InlineStyle("code"),
  em: new InlineStyle("em"),
  strong: new InlineStyle("strong")
}

InlineStyle.link = (href, title) => new InlineStyle("link", {href: href, title: title})
