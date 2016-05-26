import {Schema, Block, Inline, Text, Attribute, MarkType} from "../model"
export {Text}

// ;; The default top-level document node type.
export class Doc extends Block {}

// ;; The default blockquote node type.
export class BlockQuote extends Block {
  get matchDOMTag() { return {"blockquote": null} }
  toDOM() { return ["blockquote", 0] }
}

// ;; The default ordered list node type. Has a single attribute,
// `order`, which determines the number at which the list starts
// counting, and defaults to 1.
export class OrderedList extends Block {
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

// ;; The default bullet list node type.
export class BulletList extends Block {
  get matchDOMTag() { return {"ul": null} }
  toDOM() { return ["ul", 0] }
}

// ;; The default list item node type.
export class ListItem extends Block {
  get matchDOMTag() { return {"li": null} }
  toDOM() { return ["li", 0] }
}

// ;; The default horizontal rule node type.
export class HorizontalRule extends Block {
  get matchDOMTag() { return {"hr": null} }
  toDOM() { return ["div", ["hr"]] }
}

// ;; The default heading node type. Has a single attribute
// `level`, which indicates the heading level, and defaults to 1.
export class Heading extends Block {
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

// ;; The default code block / listing node type. Only
// allows unmarked text nodes inside of it.
export class CodeBlock extends Block {
  get isCode() { return true }
  get matchDOMTag() { return {"pre": [null, {preserveWhitespace: true}]} }
  toDOM() { return ["pre", ["code", 0]] }
}

// ;; The default paragraph node type.
export class Paragraph extends Block {
  get matchDOMTag() { return {"p": null} }
  toDOM() { return ["p", 0] }
}

// ;; The default inline image node type. Has these
// attributes:
//
// - **`src`** (required): The URL of the image.
// - **`alt`**: The alt text.
// - **`title`**: The title of the image.
export class Image extends Inline {
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

// ;; The default hard break node type.
export class HardBreak extends Inline {
  get selectable() { return false }
  get isBR() { return true }
  get matchDOMTag() { return {"br": null} }
  toDOM() { return ["br"] }
}

// ;; The default emphasis mark type.
export class EmMark extends MarkType {
  get matchDOMTag() { return {"i": null, "em": null} }
  get matchDOMStyle() {
    return {"font-style": value => value == "italic" && null}
  }
  toDOM() { return ["em"] }
}

// ;; The default strong mark type.
export class StrongMark extends MarkType {
  get matchDOMTag() { return {"b": null, "strong": null} }
  get matchDOMStyle() {
    return {"font-weight": value => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null}
  }
  toDOM() { return ["strong"] }
}

// ;; The default link mark type. Has these attributes:
//
// - **`href`** (required): The link target.
// - **`title`**: The link's title.
export class LinkMark extends MarkType {
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

// ;; The default code font mark type.
export class CodeMark extends MarkType {
  get isCode() { return true }
  get matchDOMTag() { return {"code": null} }
  toDOM() { return ["code"] }
}

// :: Schema
// ProseMirror's default document schema.
export const defaultSchema = new Schema({
  nodes: {
    doc: {type: Doc, content: "block+"},

    paragraph: {type: Paragraph, content: "inline<_>*", group: "block"},
    blockquote: {type: BlockQuote, content: "block+", group: "block"},
    ordered_list: {type: OrderedList, content: "list_item+", group: "block"},
    bullet_list: {type: BulletList, content: "list_item+", group: "block"},
    horizontal_rule: {type: HorizontalRule, group: "block"},
    heading: {type: Heading, content: "inline<_>*", group: "block"},
    code_block: {type: CodeBlock, content: "text*", group: "block"},

    list_item: {type: ListItem, content: "block+"},

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
