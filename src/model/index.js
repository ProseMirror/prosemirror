export {compareMarkup} from "./node"
export {nodeTypes, $fromJSON, $node, $text} from "./schema"
export {Pos} from "./pos"

import * as style from "./style"
export {style}

export {sliceBefore, sliceAfter, sliceBetween} from "./slice"
export {spanAtOrBefore, getSpan, spanStylesAt, rangeHasStyle} from "./inline"

export {findDiffStart, findDiffEnd} from "./diff"
