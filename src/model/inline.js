// Primitive operations on inline content

import {containsStyle} from "./style"

export function getSpan(doc, pos) {
  return spanAtOrBefore(doc.path(pos.path), pos.offset).node
}

/**
 * Given a parent node and an offset, get the child node the offset falls inside.
 */
export function spanAtOrBefore(parent, offset) {
  for (let i = 0; i < parent.length; i++) {
    let child = parent.child(i)
    offset -= child.offset
    if (offset <= 0)
      return {node: child, offset: i, innerOffset: offset + child.offset}
  }
  return {node: null, offset: 0, innerOffset: 0}
}

const empty = []

export function spanStylesAt(doc, pos) {
  let {node} = spanAtOrBefore(doc.path(pos.path), pos.offset)
  return node ? node.styles : empty
}

export function rangeHasStyle(doc, from, to, type) {
  let found = false
  doc.inlineNodesBetween(from, to, node => {
    if (containsStyle(node.styles, type)) found = true
  })
  return found
}
