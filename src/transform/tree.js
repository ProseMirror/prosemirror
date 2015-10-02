import {nodeTypes} from "../model"

export function copyStructure(node, from, to, f, depth = 0) {
  if (node.type.block) {
    return f(node, from, to)
  } else {
    if (!node.length) return node
    let start = from ? from.path[depth] : 0
    let end = to ? to.path[depth] : node.length - 1
    let content = node.slice(0, start)
    if (start == end) {
      content.push(copyStructure(node.child(start), from, to, f, depth + 1))
    } else {
      content.push(copyStructure(node.child(start), from, null, f, depth + 1))
      for (let i = start + 1; i < end; i++)
        content.push(copyStructure(node.child(i), null, null, f, depth + 1))
      content.push(copyStructure(node.child(end), null, to, f, depth + 1))
    }
    for (let i = end + 1; i < node.length; i++)
      content.push(node.child(i))
    return node.copy(content)
  }
}

export function copyInline(node, from, to, f) {
  let start = from ? from.offset : 0
  let end = to ? to.offset : node.maxOffset
  let copied = node.slice(0, start).concat(node.slice(start, end).map(f)).concat(node.slice(end))
  for (let i = copied.length - 2; i >= 0; i--) {
    let merged = copied[i].maybeMerge(copied[i + 1])
    if (merged) copied.splice(i, 2, merged)
  }
  return node.copy(copied)
}

export function forSpansBetween(doc, from, to, f) {
  let path = []
  function scan(node, from, to) {
    if (node.type.block) {
      let startOffset = from ? from.offset : 0
      let endOffset = to ? to.offset : node.maxOffset
      for (let i = 0, offset = 0; offset < endOffset; i++) {
        let child = node.child(i), size = child.offset
        offset += size
        if (offset > startOffset)
          f(child, path, Math.max(offset - child.offset, startOffset), Math.min(offset, endOffset))
      }
    } else if (node.length) {
      let start = from ? from.path[path.length] : 0
      let end = to ? to.path[path.length] + 1 : node.length
      for (let i = start; i < end; i++) {
        path.push(i)
        scan(node.child(i), i == start && from, i == end - 1 && to)
        path.pop()
      }
    }
  }
  scan(doc, from, to)
}

export function isFlatRange(from, to) {
  if (from.path.length != to.path.length) return false
  for (let i = 0; i < from.path.length; i++)
    if (from.path[i] != to.path[i]) return false
  return from.offset <= to.offset
}

export function selectedSiblings(doc, from, to) {
  for (let i = 0, node = doc;; i++) {
    if (node.type.block)
      return {path: from.path.slice(0, i - 1), from: from.path[i - 1], to: from.path[i - 1] + 1}
    let fromEnd = i == from.path.length, toEnd = i == to.path.length
    let left = fromEnd ? from.offset : from.path[i]
    let right = toEnd ? to.offset : to.path[i]
    if (fromEnd || toEnd || left != right)
      return {path: from.path.slice(0, i), from: left, to: right + (toEnd ? 0 : 1)}
    node = node.child(left)
  }
}

export function blocksBetween(doc, from, to, f) {
  let path = []
  function scan(node, from, to) {
    if (node.type.block) {
      f(node, path)
    } else {
      let fromMore = from && from.path.length > path.length
      let toMore = to && to.path.length > path.length
      let start = !from ? 0 : fromMore ? from.path[path.length] : from.offset
      let end = !to ? node.length : toMore ? to.path[path.length] + 1 : to.offset
      for (let i = start; i < end; i++) {
        path.push(i)
        scan(node.child(i), fromMore && i == start ? from : null, toMore && i == end - 1 ? to : null)
        path.pop()
      }
    }
  }
  scan(doc, from, to)
}

export function isPlainText(node) {
  if (node.length == 0) return true
  let child = node.firstChild
  return node.length == 1 && child.type == nodeTypes.text && child.styles.length == 0
}

function canBeJoined(node, offset, depth) {
  if (!depth || offset == 0 || offset == node.length) return false
  let left = node.child(offset - 1), right = node.child(offset)
  return left.sameMarkup(right)
}

export function replaceHasEffect(doc, from, to) {
  for (let depth = 0, node = doc;; depth++) {
    let fromEnd = depth == from.depth, toEnd = depth == to.depth
    if (fromEnd || toEnd || from.path[depth] != to.path[depth]) {
      let gapStart, gapEnd
      if (fromEnd) {
        gapStart = from.offset
      } else {
        gapStart = from.path[depth] + 1
        for (let i = depth + 1, n = node.child(gapStart - 1); i <= from.path.length; i++) {
          if (i == from.path.length) {
            if (from.offset < n.maxOffset) return true
          } else {
            if (from.path[i] + 1 < n.maxOffset) return true
            n = n.child(from.path[i])
          }
        }
      }
      if (toEnd) {
        gapEnd = to.offset
      } else {
        gapEnd = to.path[depth]
        for (let i = depth + 1; i <= to.path.length; i++) {
          if ((i == to.path.length ? to.offset : to.path[i]) > 0) return true
        }
      }
      if (gapStart != gapEnd) return true
      return canBeJoined(node, gapStart, Math.min(from.depth, to.depth) - depth)
    } else {
      node = node.child(from.path[depth])
    }
  }
}

export function samePathDepth(a, b) {
  for (let i = 0;; i++)
    if (i == a.path.length || i == b.path.length || a.path[i] != b.path[i])
      return i
}
