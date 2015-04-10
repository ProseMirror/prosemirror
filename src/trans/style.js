import {style, Pos, Node, inline} from "../model"

import {defineTransform, Result, Step} from "./transform"
import {nullMap} from "./map"

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

function addInline(node, child) {
  node.push(child)
  inline.stitchTextNodes(node, node.content.length - 1)
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
  apply(doc, data) {
    return new Result(doc, copyStructure(doc, data.from, data.to, (node, from, to) => {
      return copyInline(node, from, to, node => {
        return new Node.Inline(node.type, style.add(node.styles, data.param),
                               node.text, node.attrs)
      })
    }))
  }
})

defineTransform("removeStyle", {
  apply(doc, data) {
    return new Result(doc, copyStructure(doc, data.from, data.to, (node, from, to) => {
      return copyInline(node, from, to, node => {
        let styles = node.styles
        if (typeof data.param == "string")
          styles = style.removeType(styles, data.param)
        else if (data.param)
          styles = style.remove(styles, data.param)
        else
          styles = Node.empty
        return new Node.Inline(node.type, styles, node.text, node.attrs)
      })
    }))
  }
})

function forSpansBetween(doc, from, to, f) {
  let path = []
  function scan(node, from, to) {
    if (node.type.contains == "inline") {
      let startOffset = from ? from.offset : 0
      let endOffset = to ? to.offset : node.size
      for (let i = 0, offset = 0; offset < endOffset; i++) {
        let child = node.content[i], size = child.size
        offset += size
        if (offset > startOffset)
          f(child, path, Math.max(offset - child.size, startOffset), Math.min(offset, endOffset))
      }
    } else if (node.content.length) {
      let start = from ? from.path[path.length] : 0
      let end = to ? to.path[path.length] + 1 : node.content.length
      for (let i = start; i < end; i++) {
        path.push(i)
        scan(node.content[i], i == start && from, i == end - 1 && to)
        path.pop()
      }
    }
  }
  scan(doc, from, to)
}

function findRanges(doc, from, to, pred) {
  let openFrom = null, openTo = null, found = []
  forSpansBetween(doc, from, to, (span, path, start, end) => {
    if (pred(span)) {
      path = path.slice()
      if (!openFrom) openFrom = new Pos(path, start)
      openTo = new Pos(path, end)
    } else if (openFrom) {
      found.push({from: openFrom, to: openTo})
      openFrom = openTo = null
    }
  })
  if (openFrom) found.push({from: openFrom, to: openTo})
  return found
}

export function addStyle(doc, from, to, st) {
  return findRanges(doc, from, to, span => !style.contains(span.styles, st))
    .map(range => new Step("addStyle", range.from, range.to, st))
}

export function removeStyle(doc, from, to, st) {
  return findRanges(doc, from, to, span => {
    if (typeof st == "string")
      return style.containsType(span.styles, st)
    else if (st)
      return style.contains(span.styles, st)
    else
      return span.styles.length > 0
  }).map(range => new Step("removeStyle", range.from, range.to, st))
}
