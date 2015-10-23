import {SchemaSpec, Schema, Block, Textblock, Inline, Text,
        Attribute, StyleType} from "./schema"

export class Doc extends Block {}

export class BlockQuote extends Block {}

export class OrderedList extends Block {
  static get contains() { return "list_item" }
}
OrderedList.attributes = {order: new Attribute("1")}

export class BulletList extends Block {
  static get contains() { return "list_item" }
}

export class ListItem extends Block {
  static get category() { return "list_item" }
}

export class HorizontalRule extends Block {
  static get contains() { return null }
}

export class Heading extends Textblock {}
Heading.attributes = {level: new Attribute("1")}

export class CodeBlock extends Textblock {
  static get contains() { return "text" }
  get isCode() { return true }
}

export class Paragraph extends Textblock {}

export class Image extends Inline {}
Image.attributes = {
  src: new Attribute,
  alt: new Attribute(""),
  title: new Attribute("")
}

export class HardBreak extends Inline {}

// Style types

export class EmStyle extends StyleType {
  static get rank() { return  51 }
}

export class StrongStyle extends StyleType {
  static get rank() { return  52 }
}

export class LinkStyle extends StyleType {
  static get rank() { return  53 }
}
LinkStyle.attributes = {
  href: new Attribute,
  title: new Attribute("")
}

export class CodeStyle extends StyleType {
  static get rank() { return 101 }
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
