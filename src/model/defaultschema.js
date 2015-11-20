import {SchemaSpec, Schema, Block, Textblock, Inline, Text,
        Attribute, StyleType} from "./schema"

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
  get containsStyles() { return false }
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
}

// Style types

export class EmStyle extends StyleType {
  static get rank() { return 51 }
}

export class StrongStyle extends StyleType {
  static get rank() { return 52 }
}

export class LinkStyle extends StyleType {
  static get rank() { return 53 }
}
LinkStyle.attributes = {
  href: new Attribute,
  title: new Attribute({default: ""})
}

export class CodeStyle extends StyleType {
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
  em: EmStyle,
  strong: StrongStyle,
  link: LinkStyle,
  code: CodeStyle
})

export const defaultSchema = new Schema(defaultSpec)
