import {style, Node, inline, slice} from "../model"
import {defineTransform, flatTransform} from "./transform"

function addInline(node, child) {
  node.push(child)
  inline.stitchTextNodes(node, node.content.length - 1)
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

defineTransform("addStyle", {
  apply(doc, params) {
    let copy = copyStructure(doc, params.pos, params.end || params.pos, (node, from, to) => {
      if (node.type == Node.types.code_block) return node
      return copyInline(node, from, to, node => {
        return new Node.Inline(node.type, style.add(node.styles, params.style),
                               node.text, node.attrs)
      })
    })
    return flatTransform(doc, copy)
  },
  invert(result, params) {
    return {name: "replace", pos: result.map(params.pos), end: result.map(params.end),
            source: result.before, from: params.pos, to: params.end}
  }
})

export function addStyle(from, to, style) {
  return {name: "addStyle", pos: from, end: to, style}
}

defineTransform("removeStyle", {
  apply(doc, params) {
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
    return flatTransform(doc, copy)
  },
  invert(result, params) {
    return {name: "replace", pos: result.map(params.pos), end: result.map(params.end),
            source: result.before, from: params.pos, to: params.end}
  }
})

export function removeStyle(from, to, style) {
  return {name: "removeStyle", pos: from, end: to, style}
}

defineTransform("setType", {
  apply(doc, params) {
    let copy = copyStructure(doc, params.pos, params.end || params.pos, node => {
      let copy = node.copy(node.content)
      if (params.node) {
        copy.type = params.node.type
        copy.attrs = params.node.attrs
      } else {
        copy.type = Node.types[params.type]
        copy.attrs = params.attrs || copy.type.defaultAttrs
      }
      if (copy.type == Node.types.code_block) inline.clearMarkup(copy)
      return copy
    })
    return flatTransform(doc, copy)
  },
  invert(result, params) {
    let oldNode = result.before.path(params.pos.path)
    return {name: "setType", pos: result.map(params.pos), end: params.end && result.map(params.end),
            type: oldNode.type.name, attrs: oldNode.attrs}
  }
})

export function setBlockType(from, to, type, attrs) {
  return {name: "setType", pos: from, end: to, type: type, attrs: attrs}
}
