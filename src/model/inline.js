// Primitive operations on inline content

import {Node} from "./node"
import * as style from "./style"

export function getSpan(doc, pos) {
  return spanAtOrBefore(doc.path(pos.path), pos.offset).node
}

export function spanAtOrBefore(parent, offset) {
  for (let i = 0; i < parent.width; i++) {
    let child = parent.child(i)
    offset -= child.offset
    if (offset <= 0)
      return {node: child, offset: i, innerOffset: offset + child.offset}
  }
  return {node: null, offset: 0, innerOffset: 0}
}

export function spanStylesAt(doc, pos) {
  let {node} = spanAtOrBefore(doc.path(pos.path), pos.offset)
  return node ? node.styles : Node.empty
}

export function rangeHasStyle(doc, from, to, type) {
  function scan(node, from, to, type, depth) {
    if (node.type.block) {
      let start = from ? from.offset : 0
      let end = to ? to.offset : 1e5
      for (let i = 0, offset = 0; i < node.width; i++) {
        let child = node.child(i), size = child.offset
        if (offset < end && offset + size > start && style.containsType(child.styles, type))
          return true
        offset += size
      }
    } else if (node.width) {
      let start = from ? from.path[depth] : 0
      let end = to ? to.path[depth] : node.width - 1
      if (start == end) {
        return scan(node.child(start), from, to, type, depth + 1)
      } else {
        let found = scan(node.child(start), from, null, type, depth + 1)
        for (let i = start + 1; i < end && !found; i++)
          found = scan(node.child(i), null, null, type, depth + 1)
        return found || scan(node.child(end), null, to, type, depth + 1)
      }
    }
  }
  return scan(doc, from, to, type, 0)
}
