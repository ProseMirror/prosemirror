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
  for (let i = 0;; i++) {
    let child = parent.content[i]
    offset -= child.size
    if (offset <= 0)
      return {node: child, offset: i, innerOffset: offset + child.size}
  }
}

export function hasStyle(doc, pos, st) {
  let {node} = inlineNodeAtOrBefore(doc.path(pos.path), pos.offset)
  return style.contains(node.styles, st)
}

export function insertText(doc, pos, text) {
  if (!text) return Transform.identity(doc)

  let copy = slice.around(doc, pos)
  let parent = copy.path(pos.path)
  let {node, offset, innerOffset} = inlineNodeAtOrBefore(parent, pos.offset)
  if (node.type == Node.types.text) {
    let newText = node.text.slice(0, innerOffset) + text + node.text.slice(innerOffset)
    parent.content[offset] = new Node.Inline(node.type, node.styles, newText, node.attrs)
  } else {
    let newNode = new Node.Inline(Node.types.text, node.styles, text)
    if (innerOffset == 0) {
      parent.content.unshift(newNode)
    } else {
      parent.content.splice(offset + 1, 0, newNode)
      stitchTextNodes(parent, offset + 2)
    }
  }
  let parentSize = copy.size

  let transform = new Transform(doc, copy, pos)
  let end = new Pos(pos.path, parentSize)
  transform.chunk(end, pos => new Pos(pos.path, pos.offset + text.length))
  transform.chunk(null, pos => pos)
  return transform
}
