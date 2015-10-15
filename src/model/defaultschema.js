import {SchemaSpec, Schema, Block, Textblock, Inline, Text,
        Attribute, InlineStyle} from "./schema"

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
  get plainText() { return true }
}

export class Paragraph extends Textblock {}

export class Image extends Inline {}
Image.attributes = {
  src: new Attribute,
  title: new Attribute(""),
  alt: new Attribute("")
}

export class HardBreak extends Inline {}

export const style = {
  code: new InlineStyle("code"),
  em: new InlineStyle("em"),
  strong: new InlineStyle("strong"),
  link: new InlineStyle("link", {
    href: new Attribute,
    title: new Attribute("")
  })
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
  code: style.code,
  em: style.em,
  strong: style.strong,
  link: style.link
})

export const defaultSchema = new Schema(defaultSpec)
