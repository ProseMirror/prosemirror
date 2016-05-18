import {Schema, Block, Textblock, Inline, Text, Attribute, MarkType} from "./schema"

// ;; The default top-level document node type.
export class Doc extends Block {}

// ;; The default blockquote node type.
export class BlockQuote extends Block {}

// ;; The default ordered list node type. Has a single attribute,
// `order`, which determines the number at which the list starts
// counting, and defaults to 1.
export class OrderedList extends Block {
  get attrs() { return {order: new Attribute({default: 1})} }
}

// ;; The default bullet list node type.
export class BulletList extends Block {}

// ;; The default list item node type.
export class ListItem extends Block {}

// ;; The default horizontal rule node type.
export class HorizontalRule extends Block {}

// ;; The default heading node type. Has a single attribute
// `level`, which indicates the heading level, and defaults to 1.
export class Heading extends Textblock {
  get attrs() { return {level: new Attribute({default: 1})} }
  // :: number
  // Controls the maximum heading level. Has the value 6 in the
  // `Heading` class, but you can override it in a subclass.
  get maxLevel() { return 6 }
}

// ;; The default code block / listing node type. Only
// allows unmarked text nodes inside of it.
export class CodeBlock extends Textblock {
  get isCode() { return true }
}

// ;; The default paragraph node type.
export class Paragraph extends Textblock {}

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
}

// ;; The default hard break node type.
export class HardBreak extends Inline {
  get selectable() { return false }
  get isBR() { return true }
}

// ;; The default emphasis mark type.
export class EmMark extends MarkType {
  static get rank() { return 31 }
}

// ;; The default strong mark type.
export class StrongMark extends MarkType {
  static get rank() { return 32 }
}

// ;; The default link mark type. Has these attributes:
//
// - **`href`** (required): The link target.
// - **`title`**: The link's title.
export class LinkMark extends MarkType {
  static get rank() { return 60 }
  get attrs() {
    return {
      href: new Attribute,
      title: new Attribute({default: ""})
    }
  }
}

// ;; The default code font mark type.
export class CodeMark extends MarkType {
  static get rank() { return 101 }
  get isCode() { return true }
}

// :: Schema
// ProseMirror's default document schema.
export const defaultSchema = new Schema({
  nodes: {
    doc: {type: Doc, content: "block+"},
    blockquote: {type: BlockQuote, content: "block+"},
    ordered_list: {type: OrderedList, content: "list_item+"},
    bullet_list: {type: BulletList, content: "list_item+"},
    list_item: {type: ListItem, content: "block+"},
    horizontal_rule: {type: HorizontalRule},

    paragraph: {type: Paragraph, content: "inline<_>*"},
    heading: {type: Heading, content: "inline<_>*"},
    code_block: {type: CodeBlock, content: "text*"},

    text: {type: Text},
    image: {type: Image},
    hard_break: {type: HardBreak}
  },

  groups: {
    block: ["paragraph", "blockquote", "ordered_list", "bullet_list", "heading", "code_block", "horizontal_rule"],
    inline: ["text", "image", "hard_break"]
  },

  marks: {
    em: EmMark,
    strong: StrongMark,
    link: LinkMark,
    code: CodeMark
  }
})
