// Primitive operations on inline content

import {Node, Span, nodeTypes} from "./node"
import * as style from "./style"

export function stitchTextNodes(node, at) {
  let before, after
  if (at && node.content.length > at &&
      (before = node.content[at - 1]).type == nodeTypes.text &&
      (after = node.content[at]).type == nodeTypes.text &&
      style.sameSet(before.styles, after.styles)) {
    let joined = Span.text(before.text + after.text, before.styles)
    node.content.splice(at - 1, 2, joined)
    return true
  }
}

export function clearMarkup(node) {
  if (node.content.length > 1 || node.content[0].type != nodeTypes.text || node.content[0].styles.length) {
    let text = ""
    for (var i = 0; i < node.content.length; i++) {
      let child = node.content[i]
      if (child.type == nodeTypes.text) text += child.text
    }
    node.content = [Span.text(text)]
  }
}

export function getSpan(doc, pos) {
  return spanAtOrBefore(doc.path(pos.path), pos.offset).node
}

export function spanAtOrBefore(parent, offset) {
  for (let i = 0; i < parent.content.length; i++) {
    let child = parent.content[i]
    offset -= child.size
    if (offset <= 0)
      return {node: child, offset: i, innerOffset: offset + child.size}
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
      for (let i = 0, offset = 0; i < node.content.length; i++) {
        let child = node.content[i], size = child.text.length
        if (offset < end && offset + size > start && style.containsType(child.styles, type))
          return true
        offset += size
      }
    } else if (node.content.length) {
      let start = from ? from.path[depth] : 0
      let end = to ? to.path[depth] : node.content.length - 1
      if (start == end) {
        return scan(node.content[start], from, to, type, depth + 1)
      } else {
        let found = scan(node.content[start], from, null, type, depth + 1)
        for (let i = start + 1; i < end && !found; i++)
          found = scan(node.content[i], null, null, type, depth + 1)
        return found || scan(node.content[end], null, to, type, depth + 1)
      }
    }
  }
  return scan(doc, from, to, type, 0)
}

export function splitSpansAt(parent, offset_) {
  let {node, offset, innerOffset} = spanAtOrBefore(parent, offset_)
  if (innerOffset && innerOffset != node.size) {
    parent.content.splice(offset, 1, node.slice(0, innerOffset), node.slice(innerOffset))
    offset += 1
  } else if (innerOffset) {
    offset += 1
  }
  return {offset: offset, styles: node ? node.styles : Node.empty}
}
