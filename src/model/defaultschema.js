import {SchemaSpec, Schema, Block, Textblock, Inline, Text, Attribute, MarkType} from "./schema"

// ;; The default top-level document node type.
export class Doc extends Block {
  static get kinds() { return "doc" }
}

// ;; The default blockquote node type.
export class BlockQuote extends Block {}

// ;; The default ordered list node type. Has a single attribute,
// `order`, which determines the number at which the list starts
// counting, and defaults to 1.
export class OrderedList extends Block {
  get contains() { return "list_item" }
  get attrs() { return {order: new Attribute({default: "1"})} }
}

// ;; The default bullet list node type.
export class BulletList extends Block {
  get contains() { return "list_item" }
}

// ;; The default list item node type.
export class ListItem extends Block {
  static get kinds() { return "list_item" }
}

// ;; The default horizontal rule node type.
export class HorizontalRule extends Block {
  get contains() { return null }
}

// ;; The default heading node type. Has a single attribute
// `level`, which indicates the heading level, and defaults to 1.
export class Heading extends Textblock {
  get attrs() { return {level: new Attribute({default: "1"})} }
  get maxLevel() { return 6 }
}

// ;; The default code block / listing node type. Only
// allows unmarked text nodes inside of it.
export class CodeBlock extends Textblock {
  get contains() { return "text" }
  get containsMarks() { return false }
  get isCode() { return true }
}

// ;; The default paragraph node type.
export class Paragraph extends Textblock {
  get defaultTextblock() { return true }
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
}

// ;; The default hard break node type.
export class HardBreak extends Inline {
  get selectable() { return false }
  get isBR() { return true }
}

// ;; The default emphasis mark type.
export class EmMark extends MarkType {
  static get rank() { return 51 }
}

// ;; The default strong mark type.
export class StrongMark extends MarkType {
  static get rank() { return 52 }
}

// ;; The default link mark type. Has these attributes:
//
// - **`href`** (required): The link target.
// - **`title`**: The link's title.
export class LinkMark extends MarkType {
  static get rank() { return 25 }
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

// :: SchemaSpec
// The specification for the default schema.
const defaultSpec = new SchemaSpec({
  doc: Doc,
  blockquote: BlockQuote,
  ordered_list: OrderedList,
  bullet_list: BulletList,
  list_item: ListItem,
  horizontal_rule: HorizontalRule,

  paragraph: Paragraph,
  heading: Heading,
  code_block: CodeBlock,

  text: Text,
  image: Image,
  hard_break: HardBreak
}, {
  em: EmMark,
  strong: StrongMark,
  link: LinkMark,
  code: CodeMark
})

// :: Schema
// ProseMirror's default document schema.
export const defaultSchema = new Schema(defaultSpec)
