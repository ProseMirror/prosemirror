// Primitive operations on inline content

import {containsStyle} from "./style"

const empty = []

export function spanStylesAt(doc, pos) {
  let parent = doc.path(pos.path)
  let node = parent.childBefore(pos.offset).node || parent.firstChild
  return node ? node.styles : empty
}

export function rangeHasStyle(doc, from, to, type) {
  let found = false
  doc.inlineNodesBetween(from, to, node => {
    if (containsStyle(node.styles, type)) found = true
  })
  return found
}
