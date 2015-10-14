export {compareMarkup} from "./node"
export {SchemaSpec, Schema, SchemaError, Block, Textblock, Inline, Text} from "./schema"
export {defaultSchema, Doc, Blockquote, OrderedList, BulletList, ListItem,
        HorizontalRule, Paragraph, Heading, CodeBlock, Image, HardBreak} from "./defaultschema"
export {Pos} from "./pos"

import * as style from "./style"
export {style}

export {sliceBefore, sliceAfter, sliceBetween} from "./slice"
export {spanAtOrBefore, getSpan, spanStylesAt, rangeHasStyle} from "./inline"

export {findDiffStart, findDiffEnd} from "./diff"
