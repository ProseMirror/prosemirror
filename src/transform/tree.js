import {Fragment} from "../model"

export function copyStructure(node, from, to, f, depth = 0) {
  if (node.isTextblock) {
    return f(node, from ? from.offset : 0, to ? to.offset : node.size)
  } else {
    if (!node.size) return node
    let start = from ? from.path[depth] : 0
    let end = to ? to.path[depth] + 1 : node.size
    let content = node.content.toArray(0, start)
    for (let iter = node.iter(start, end), child; child = iter.next().value;) {
      let passFrom = iter.offset - child.width == start ? from : null
      let passTo = iter.offset == end ? to : null
      content.push(copyStructure(child, passFrom, passTo, f, depth + 1))
    }
    return node.copy(Fragment.fromArray(content.concat(node.content.toArray(end))))
  }
}

export function copyInline(node, from, to, f) {
  return node.splice(from, to, node.content.slice(from, to).map(f))
}

export function isFlatRange(from, to) {
  if (from.path.length != to.path.length) return false
  for (let i = 0; i < from.path.length; i++)
    if (from.path[i] != to.path[i]) return false
  return from.offset <= to.offset
}

function canBeJoined(node, offset, depth) {
  if (!depth || offset == 0 || offset == node.size) return false
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
            if (from.offset < n.size) return true
          } else {
            if (from.path[i] + 1 < n.size) return true
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
