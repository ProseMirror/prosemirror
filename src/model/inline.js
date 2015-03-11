// Primitive operations on inline content

import * as style from "./style"
import Node from "./node"
import Pos from "./pos"
import {stitchTextNodes} from "./join"
import Transform from "./transform"
import * as slice from "./slice"

function addInline(node, child) {
  node.push(child)
  stitchTextNodes(node, node.content.length - 1)
}

function copyStructure(node, from, to, f, depth = 0) {
  if (node.type.contains == "inline") {
    return f(node, from, to)
  } else {
    let copy = node.copy()
    let start = from ? from.path[depth] : 0
    let end = to ? to.path[depth] : node.content.length - 1
    copy.pushFrom(node, 0, start)
    if (start == end) {
      copy.push(copyStructure(node.content[start], from, to, f, depth + 1))
    } else {
      copy.push(copyStructure(node.content[start], from, null, f, depth + 1))
      for (let i = start + 1; i < end; i++)
        copy.push(copyStructure(node.content[i], null, null, f, depth + 1))
      copy.push(copyStructure(node.content[end], null, to, f, depth + 1))
    }
    copy.pushFrom(node, end + 1)
    return copy
  }
}

function copyInline(node, from, to, f) {
  let copy = node.copy()
  let start = from ? from.offset : 0
  let end = to ? to.offset : node.size
  for (let ch = 0, i = 0; i < node.content.length; i++) {
    let child = node.content[i], size = child.size
    if (ch < start) {
      if (ch + size <= start) {
        copy.push(child)
      } else {
        copy.push(child.slice(0, start - ch))
        if (ch + size <= end) {
          addInline(copy, f(child.slice(start - ch)))
        } else {
          addInline(copy, f(child.slice(start - ch, end - ch)))
          addInline(copy, child.slice(end - ch))
        }
      }
    } else if (ch < end) {
      if (ch + size <= end) {
        addInline(copy, f(child))
      } else {
        addInline(copy, f(child.slice(0, end - ch)))
        addInline(copy, child.slice(end - ch))
      }
    } else {
      addInline(copy, child)
    }
    ch += size
  }
  return copy
}

export function addStyle(doc, from, to, add) {
  return copyStructure(doc, from, to, (node, from, to) => {
    return copyInline(node, from, to, node => {
      return new Node.Inline(node.type, style.add(node.styles, add),
                             node.text, node.attrs)
    })
  })
}

export function removeStyle(doc, from, to, rm) {
  return copyStructure(doc, from, to, (node, from, to) => {
    return copyInline(node, from, to, node => {
      return new Node.Inline(node.type, style.remove(node.styles, rm),
                             node.text, node.attrs)
    })
  })
}

function inlineNodeAtOrBefore(parent, offset) {
  for (let i = 0; i < parent.content.length; i++) {
    let child = parent.content[i]
    offset -= child.size
    if (offset <= 0)
      return {node: child, offset: i, innerOffset: offset + child.size}
  }
  return {node: null, offset: 0, innerOffset: 0}
}

export function hasStyle(doc, pos, st) {
  let {node} = inlineNodeAtOrBefore(doc.path(pos.path), pos.offset)
  return style.contains(node ? node.styles : [], st)
}

export function splitInlineAt(parent, offset) {
  let {node, offset, innerOffset} = inlineNodeAtOrBefore(parent, offset)
  if (innerOffset && innerOffset != node.size) {
    parent.content.splice(offset, 1, node.slice(0, innerOffset), node.slice(innerOffset))
    offset += 1
  } else if (innerOffset) {
    offset += 1
  }
  return {offset: offset, styles: node ? node.styles : Node.empty}
}

export function insertNode(doc, pos, node) {
  let copy = slice.around(doc, pos)
  let parent = copy.path(pos.path)
  let parentSize = parent.size, nodeSize = node.size
  let {offset, styles} = splitInlineAt(parent, pos.offset)
  parent.content.splice(offset, 0, new Node.Inline(node.type, styles, node.text, node.attrs))
  if (node.type == Node.types.text) {
    stitchTextNodes(parent, offset + 1)
    stitchTextNodes(parent, offset)
  }

  let transform = new Transform(doc, copy, pos)
  let end = new Pos(pos.path, parentSize)
  transform.chunk(end, pos => new Pos(pos.path, pos.offset + nodeSize))
  return transform
}

export function insertText(doc, pos, text) {
  if (!text) return Transform.identity(doc)

  return insertNode(doc, pos, new Node.Inline(Node.types.text, null, text))
}
