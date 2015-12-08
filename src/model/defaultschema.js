import {SchemaSpec, Schema, Block, Textblock, Inline, Text, Attribute, MarkType} from "./schema"

export class Doc extends Block {
  static get kind() { return "." }
}

export class BlockQuote extends Block {}

export class OrderedList extends Block {
  static get contains() { return "list_item" }
}
OrderedList.attributes = {order: new Attribute({default: "1"})}

export class BulletList extends Block {
  static get contains() { return "list_item" }
}

export class ListItem extends Block {
  static get kind() { return "." }
}

export class HorizontalRule extends Block {
  static get contains() { return null }
}

export class Heading extends Textblock {}
Heading.attributes = {level: new Attribute({default: "1"})}

export class CodeBlock extends Textblock {
  static get contains() { return "text" }
  get containsMarks() { return false }
  get isCode() { return true }
}

export class Paragraph extends Textblock {
  get defaultTextblock() { return true }
}

export class Image extends Inline {}
Image.attributes = {
  src: new Attribute,
  alt: new Attribute({default: ""}),
  title: new Attribute({default: ""})
}

export class HardBreak extends Inline {
  get selectable() { return false }
  get isBR() { return true }
}

// Mark types

export class EmMark extends MarkType {
  static get rank() { return 51 }
}

export class StrongMark extends MarkType {
  static get rank() { return 52 }
}

export class LinkMark extends MarkType {
  static get rank() { return 53 }
}
LinkMark.attributes = {
  href: new Attribute,
  title: new Attribute({default: ""})
}

export class CodeMark extends MarkType {
  static get rank() { return 101 }
  get isCode() { return true }
}

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

export const defaultSchema = new Schema(defaultSpec)
