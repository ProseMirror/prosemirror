import {Node, Pos, inline} from "../model"

export function copyStructure(node, from, to, f, depth = 0) {
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

export function copyInline(node, from, to, f) {
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

export function forSpansBetween(doc, from, to, f) {
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

export function findRanges(doc, from, to, id) {
  let openFrom = null, openTo = null, found = [], curID = null
  forSpansBetween(doc, from, to, (span, path, start, end) => {
    let spanID = id(span)
    if (openFrom && spanID != curID) {
      found.push({from: openFrom, to: openTo, id: curID})
      openFrom = openTo = null
      curID = spanID
    }
    if (spanID) {
      path = path.slice()
      if (!openFrom) openFrom = new Pos(path, start)
      openTo = new Pos(path, end)
    }
  })
  if (openFrom) found.push({from: openFrom, to: openTo, id: curID})
  return found
}

export function copyTo(node, path, depth = 0) {
  if (depth == path.length)
    return node.copy(node.content.slice())

  let copy = node.copy()
  let n = path[depth]
  copy.pushFrom(node, 0, n)
  copy.push(copyTo(node.content[n], path, depth + 1))
  copy.pushFrom(node, n + 1)
  return copy
}

export function isFlatRange(from, to) {
  if (from.path.length != to.path.length) return false
  for (let i = 0; i < from.path.length; i++)
    if (from.path[i] != to.path[i]) return false
  return from.offset < to.offset
}

export function rangesBetween(doc, from, to, f) {
  function scanAfter(node, depth) {
    if (depth == from.path.length) {
      if (from.offset != node.maxOffset) f(from.path, from.offset, node.maxOffset)
    } else {
      let start = from.path[depth]
      scanAfter(node.content[start], depth + 1)
      if (start + 1 != node.content.length) f(from.path.slice(0, depth), start + 1, node.content.length)
    }
  }
  function scanBefore(node) {
    if (depth == to.path.length) {
      if (from.offset != 0) f(from.path, 0, to.offset)
    } else {
      let end = to.path[depth]
      if (end != 0) f(to.path.slice(0, depth), 0, end)
      scanBefore(node.content[end], depth + 1)
    }
  }
  function scan(node, depth) {
    let endFrom = from.path.length == depth, endTo = to.path.length == depth
    if (endFrom && endTo) {
      if (from.offset != to.offset) f(from.path, from.offset, to.offset)
    } else if (endFrom) {
      let end = to.path[depth]
      if (from.offset != end) f(from.path.slice(0, depth), from.offset, end)
      scanBefore(node.content[end], depth + 1)
    } else if (endTo) {
      let start = from.path[depth]
      scanAfter(node.content[start], depth + 1)
      if (start + 1 != to.offset) f(from.path.slice(0, depth), start + 1, to.offset)
    } else {
      scan(node.content[from.path[depth]], depth + 1)
    }
  }
  scan(doc, 0)
}

export function selectedSiblings(doc, from, to) {
  for (let i = 0, node = doc;; i++) {
    if (node.type.contains == "inline")
      return {path: from.path.slice(0, i - 1), from: from.path[i - 1], to: from.path[i - 1] + 1}
    let fromEnd = i == from.path.length, toEnd = i == to.path.length
    let left = fromEnd ? from.offset : from.path[i]
    let right = toEnd ? to.offset : to.path[i]
    if (fromEnd || toEnd || left != right)
      return {path: from.path.slice(0, i), from: left, to: right + (toEnd ? 0 : 1)}
    node = node.content[left]
  }
}

export function blocksBetween(doc, from, to, f) {
  let path = []
  function scan(node, from, to) {
    if (node.type.contains == "inline") {
      f(node, path)
    } else {
      let fromMore = from && from.path.length > path.length
      let toMore = to && to.path.length > path.length
      let start = !from ? 0 : fromMore ? from.path[path.length] : from.offset
      let end = !to ? node.content.length : toMore ? to.path[path.length] + 1 : to.offset
      for (let i = start; i < end; i++) {
        path.push(i)
        scan(node.content[i], fromMore && i == 0 ? from : null, toMore && i == end - 1 ? to : null)
        path.pop()
      }
    }
  }
  scan(doc, from, to)
}

export function isPlainText(node) {
  if (node.content.length == 0) return true
  let child = node.content[0]
  return node.content.length == 1 && child.type == Node.types.text && child.styles.length == 0
}
