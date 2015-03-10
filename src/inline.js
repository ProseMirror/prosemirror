// Primitive operations on inline content

import * as style from "./style"
import Node from "./node"
import {stitchTextNodes} from "./join"

function addInline(node, child) {
  node.push(child)
  stitchTextNodes(node, node.content.length - 1)
}

function apply(node, from, to, f, depth = 0) {
  let copy = node.copy()
  if (node.type.contains == "inline") {
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
  } else {
    let start = from ? from.path[depth] : 0
    let end = to ? to.path[depth] : node.content.length - 1
    copy.pushFrom(node, 0, start)
    if (start == end) {
      copy.push(apply(node.content[start], from, to, f, depth + 1))
    } else {
      copy.push(apply(node.content[start], from, null, f, depth + 1))
      for (let i = start + 1; i < end; i++)
        copy.push(apply(node.content[i], null, null, f, depth + 1))
      copy.push(apply(node.content[end], null, to, f, depth + 1))
    }
    copy.pushFrom(node, end + 1)
  }
  return copy
}

export function addStyle(doc, from, to, add) {
  return apply(doc, from, to, node => {
    return new Node.Inline(node.type, style.add(node.styles, add), node.text, node.attrs)
  })
}

export function removeStyle(doc, from, to, rm) {
  return apply(doc, from, to, node => {
    return new Node.Inline(node.type, style.remove(node.styles, rm), node.text, node.attrs)
  })
}
