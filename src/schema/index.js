const {Schema, Block, Inline, Text, Attribute, MarkType} = require("../model")
exports.Text = Text

// !! This module defines a number of basic node and mark types, and a
// schema that combines them.

// ;; The default top-level document node type.
class Doc extends Block {}
exports.Doc = Doc

// ;; The default blockquote node type.
class BlockQuote extends Block {
  get matchDOMTag() { return {"blockquote": null} }
  toDOM() { return ["blockquote", 0] }
}
exports.BlockQuote = BlockQuote

// ;; The default ordered list node type. Has a single attribute,
// `order`, which determines the number at which the list starts
// counting, and defaults to 1.
class OrderedList extends Block {
  get attrs() { return {order: new Attribute({default: 1})} }
  get matchDOMTag() {
    return {"ol": dom => ({
      order: dom.hasAttribute("start") ? +dom.getAttribute("start") : 1
    })}
  }
  toDOM(node) {
    return ["ol", {start: node.attrs.order == 1 ? null : node.attrs.order}, 0]
  }
}
exports.OrderedList = OrderedList

// ;; The default bullet list node type.
class BulletList extends Block {
  get matchDOMTag() { return {"ul": null} }
  toDOM() { return ["ul", 0] }
}
exports.BulletList = BulletList

// ;; The default list item node type.
class ListItem extends Block {
  get matchDOMTag() { return {"li": null} }
  toDOM() { return ["li", 0] }
}
exports.ListItem = ListItem

// ;; The default horizontal rule node type.
class HorizontalRule extends Block {
  get matchDOMTag() { return {"hr": null} }
  toDOM() { return ["div", ["hr"]] }
}
exports.HorizontalRule = HorizontalRule

// ;; The default heading node type. Has a single attribute
// `level`, which indicates the heading level, and defaults to 1.
class Heading extends Block {
  get attrs() { return {level: new Attribute({default: 1})} }
  // :: number
  // Controls the maximum heading level. Has the value 6 in the
  // `Heading` class, but you can override it in a subclass.
  get maxLevel() { return 6 }
  get matchDOMTag() {
    return {
      "h1": {level: 1},
      "h2": {level: 2},
      "h3": {level: 3},
      "h4": {level: 4},
      "h5": {level: 5},
      "h6": {level: 6}
    }
  }
  toDOM(node) { return ["h" + node.attrs.level, 0] }
}
exports.Heading = Heading

// ;; The default code block / listing node type. Only
// allows unmarked text nodes inside of it.
class CodeBlock extends Block {
  get isCode() { return true }
  get matchDOMTag() { return {"pre": [null, {preserveWhitespace: true}]} }
  toDOM() { return ["pre", ["code", 0]] }
}
exports.CodeBlock = CodeBlock

// ;; The default paragraph node type.
class Paragraph extends Block {
  get matchDOMTag() { return {"p": null} }
  toDOM() { return ["p", 0] }
}
exports.Paragraph = Paragraph

// ;; The default inline image node type. Has these
// attributes:
//
// - **`src`** (required): The URL of the image.
// - **`alt`**: The alt text.
// - **`title`**: The title of the image.
class Image extends Inline {
  get attrs() {
    return {
      src: new Attribute,
      alt: new Attribute({default: ""}),
      title: new Attribute({default: ""})
    }
  }
  get draggable() { return true }
  get matchDOMTag() {
    return {"img[src]": dom => ({
      src: dom.getAttribute("src"),
      title: dom.getAttribute("title"),
      alt: dom.getAttribute("alt")
    })}
  }
  toDOM(node) { return ["img", node.attrs] }
}
exports.Image = Image

// ;; The default hard break node type.
class HardBreak extends Inline {
  get selectable() { return false }
  get isBR() { return true }
  get matchDOMTag() { return {"br": null} }
  toDOM() { return ["br"] }
}
exports.HardBreak = HardBreak

// ;; The default emphasis mark type.
class EmMark extends MarkType {
  get matchDOMTag() { return {"i": null, "em": null} }
  get matchDOMStyle() {
    return {"font-style": value => value == "italic" && null}
  }
  toDOM() { return ["em"] }
}
exports.EmMark = EmMark

// ;; The default strong mark type.
class StrongMark extends MarkType {
  get matchDOMTag() { return {"b": null, "strong": null} }
  get matchDOMStyle() {
    return {"font-weight": value => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null}
  }
  toDOM() { return ["strong"] }
}
exports.StrongMark = StrongMark

// ;; The default link mark type. Has these attributes:
//
// - **`href`** (required): The link target.
// - **`title`**: The link's title.
class LinkMark extends MarkType {
  get attrs() {
    return {
      href: new Attribute,
      title: new Attribute({default: ""})
    }
  }
  get matchDOMTag() {
    return {"a[href]": dom => ({
      href: dom.getAttribute("href"), title: dom.getAttribute("title")
    })}
  }
  toDOM(node) { return ["a", node.attrs] }
}
exports.LinkMark = LinkMark

// ;; The default code font mark type.
class CodeMark extends MarkType {
  get isCode() { return true }
  get matchDOMTag() { return {"code": null} }
  toDOM() { return ["code"] }
}
exports.CodeMark = CodeMark

// :: Schema
// ProseMirror's default document schema.
const defaultSchema = new Schema({
  nodes: {
    doc: {type: Doc, content: "block+"},

    paragraph: {type: Paragraph, content: "inline<_>*", group: "block"},
    blockquote: {type: BlockQuote, content: "block+", group: "block"},
    ordered_list: {type: OrderedList, content: "list_item+", group: "block"},
    bullet_list: {type: BulletList, content: "list_item+", group: "block"},
    horizontal_rule: {type: HorizontalRule, group: "block"},
    heading: {type: Heading, content: "inline<_>*", group: "block"},
    code_block: {type: CodeBlock, content: "text*", group: "block"},

    list_item: {type: ListItem, content: "paragraph block*"},

    text: {type: Text, group: "inline"},
    image: {type: Image, group: "inline"},
    hard_break: {type: HardBreak, group: "inline"}
  },

  marks: {
    em: EmMark,
    strong: StrongMark,
    link: LinkMark,
    code: CodeMark
  }
})
exports.defaultSchema = defaultSchema
