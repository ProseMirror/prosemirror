export {compareMarkup} from "./node"
export {removeStyle, sameStyles, containsStyle} from "./style"

export {SchemaSpec, Schema, SchemaError, NodeType, Block, Textblock, Inline, Text} from "./schema"
export {defaultSchema, Doc, BlockQuote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak} from "./defaultschema"

export {Pos} from "./pos"

export {sliceBefore, sliceAfter, sliceBetween} from "./slice"
export {spanAtOrBefore, getSpan, spanStylesAt, rangeHasStyle} from "./inline"

export {findDiffStart, findDiffEnd} from "./diff"
