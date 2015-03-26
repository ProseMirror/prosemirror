// Primitive operations on inline content

import * as style from "./style"
import Node from "./node"
import Pos from "./pos"
import * as transform from "./transform"
import * as slice from "./slice"

export function stitchTextNodes(node, at) {
  let before, after
  if (at && node.content.length > at &&
      (before = node.content[at - 1]).type == Node.types.text &&
      (after = node.content[at]).type == Node.types.text &&
      style.sameSet(before.styles, after.styles)) {
    let joined = Node.text(before.text + after.text, before.styles)
    node.content.splice(at - 1, 2, joined)
    return true
  }
}

function addInline(node, child) {
  node.push(child)
  stitchTextNodes(node, node.content.length - 1)
}

function copyStructure(node, from, to, f, depth = 0) {
  if (node.type.contains == "inline") {
    return f(node, from, to)
  } else {
    let copy = node.copy()
    if (node.content.length == 0) return copy
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

transform.define("addStyle", function(doc, params) {
  let copy = copyStructure(doc, params.pos, params.end || params.pos, (node, from, to) => {
    if (node.type == Node.types.code_block) return node
    return copyInline(node, from, to, node => {
      return new Node.Inline(node.type, style.add(node.styles, params.style),
                             node.text, node.attrs)
    })
  })
  return transform.flat(doc, copy)
})

transform.define("removeStyle", function(doc, params) {
  let copy = copyStructure(doc, params.pos, params.end || params.pos, (node, from, to) => {
    return copyInline(node, from, to, node => {
      let styles = node.styles
      if (typeof params.style == "string")
        styles = style.removeType(styles, params.style)
      else if (params.style)
        styles = style.remove(styles, params.style)
      else
        styles = Node.empty
      return new Node.Inline(node.type, styles, node.text, node.attrs)
    })
  })
  return transform.flat(doc, copy)
})

transform.define("setType", function(doc, params) {
  let copy = copyStructure(doc, params.pos, params.end || params.pos, node => {
    let copy = node.copy(node.content)
    if (params.node) {
      copy.type = params.node.type
      copy.attrs = params.node.attrs
    } else {
      copy.type = Node.types[params.type]
      copy.attrs = params.attrs || copy.type.defaultAttrs
    }
    if (copy.type == Node.types.code_block) clearMarkup(copy)
    return copy
  })
  return transform.flat(doc, copy)
})

function clearMarkup(node) {
  if (node.content.length > 1 || node.content[0].type != Node.types.text || node.content[0].styles.length) {
    let text = ""
    for (var i = 0; i < node.content.length; i++) {
      let child = node.content[i]
      if (child.type == Node.types.text) text += child.text
    }
    node.content = [Node.text(text)]
  }
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

export function inlineStylesAt(doc, pos) {
  let {node} = inlineNodeAtOrBefore(doc.path(pos.path), pos.offset)
  return node ? node.styles : Node.empty
}

export function rangeHasInlineStyle(doc, from, to, type) {
  function scan(node, from, to, type, depth) {
    if (node.type.contains == "inline") {
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

function insertNode(doc, pos, node) {
  let copy = slice.around(doc, pos)
  let parent = copy.path(pos.path)
  let parentSize = parent.size, nodeSize = node.size
  let {offset, styles} = splitInlineAt(parent, pos.offset)
  parent.content.splice(offset, 0, new Node.Inline(node.type, styles, node.text, node.attrs))
  if (node.type == Node.types.text) {
    stitchTextNodes(parent, offset + 1)
    stitchTextNodes(parent, offset)
  }

  let result = new transform.Result(doc, copy, pos)
  let end = new Pos(pos.path, parentSize)
  result.chunk(end, pos => new Pos(pos.path, pos.offset + nodeSize))
  return result
}

transform.define("insertInline", function(doc, params) {
  let node = params.node || new Node.Inline(params.type, null, params.text, params.attrs)
  if (node.type != Node.types.text &&
      doc.path(params.pos.path).type == Node.types.code_block)
    return transform.identity(doc)

  return insertNode(doc, params.pos, node)
})

transform.define("insertText", function(doc, params) {
  if (!params.text) return Transform.identity(doc)
  return insertNode(doc, params.pos, Node.text(params.text))
})
