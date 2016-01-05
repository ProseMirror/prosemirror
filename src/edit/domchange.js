import {Pos, findDiffStart, findDiffEnd} from "../model"
import {fromDOM} from "../format"
import {samePathDepth} from "../transform/tree"

import {findByPath} from "./selection"

function isAtEnd(node, pos, depth) {
  for (let i = depth || 0; i < pos.path.length; i++) {
    let n = pos.path[depth]
    if (n < node.size - 1) return false
    node = node.child(n)
  }
  return pos.offset == node.size
}
function isAtStart(pos, depth) {
  if (pos.offset > 0) return false
  for (let i = depth || 0; i < pos.path.length; i++)
    if (pos.path[depth] > 0) return false
  return true
}

function parseNearSelection(pm) {
  let dom = pm.content, node = pm.doc
  let {from, to} = pm.selection
  for (let depth = 0;; depth++) {
    let toNode = node.child(to.path[depth])
    let fromStart = isAtStart(from, depth + 1)
    let toEnd = isAtEnd(toNode, to, depth + 1)
    if (fromStart || toEnd || from.path[depth] != to.path[depth] || toNode.isTextblock) {
      let startOffset = depth == from.depth ? from.offset : from.path[depth]
      if (fromStart && startOffset > 0) startOffset--
      let endOffset = depth == to.depth ? to.offset : to.path[depth] + 1
      if (toEnd && endOffset < node.size - 1) endOffset++
      let parsed = fromDOM(pm.schema, dom, {topNode: node.copy(),
                                            from: startOffset,
                                            to: dom.childNodes.length - (node.size - endOffset)})
      parsed = parsed.copy(node.content.slice(0, startOffset).append(parsed.content).append(node.content.slice(endOffset)))
      for (let i = depth - 1; i >= 0; i--) {
        let wrap = pm.doc.path(from.path.slice(0, i))
        parsed = wrap.replace(from.path[i], parsed)
      }
      return parsed
    }
    node = toNode
    dom = findByPath(dom, from.path[depth], false)
  }
}

export function applyDOMChange(pm) {
  let updated = parseNearSelection(pm)
  let changeStart = findDiffStart(pm.doc.content, updated.content)
  if (changeStart) {
    let changeEnd = findDiffEndConstrained(pm.doc.content, updated.content, changeStart)
    // Mark nodes touched by this change as 'to be redrawn'
    pm.markRangeDirty(pm.doc.siblingRange(changeStart, changeEnd.a))

    pm.tr.replace(changeStart, changeEnd.a, updated, changeStart, changeEnd.b).apply()
    return true
  } else {
    return false
  }
}

function offsetBy(first, second, pos) {
  let same = samePathDepth(first, second)
  let firstEnd = same == first.depth, secondEnd = same == second.depth
  let off = (secondEnd ? second.offset : second.path[same]) - (firstEnd ? first.offset : first.path[same])
  let shorter = firstEnd ? pos.move(off) : pos.shorten(same, off)
  if (secondEnd) return shorter
  else return shorter.extend(new Pos(second.path.slice(same), second.offset))
}

function findDiffEndConstrained(a, b, start) {
  let end = findDiffEnd(a, b)
  if (!end) return end
  if (end.a.cmp(start) < 0) return {a: start, b: offsetBy(end.a, start, end.b)}
  if (end.b.cmp(start) < 0) return {a: offsetBy(end.b, start, end.a), b: start}
  return end
}

// Text-only queries for composition events

export function textContext(data) {
  let range = getSelection().getRangeAt(0)
  let start = range.startContainer, end = range.endContainer
  if (start == end && start.nodeType == 3) {
    let value = start.nodeValue, lead = range.startOffset, end = range.endOffset
    if (data && end >= data.length && value.slice(end - data.length, end) == data)
      lead = end - data.length
    return {inside: start, lead, trail: value.length - end}
  }

  let sizeBefore = null, sizeAfter = null
  let before = start.childNodes[range.startOffset - 1] || nodeBefore(start)
  while (before.lastChild) before = before.lastChild
  if (before && before.nodeType == 3) {
    let value = before.nodeValue
    sizeBefore = value.length
    if (data && value.slice(value.length - data.length) == data)
      sizeBefore -= data.length
  }
  let after = end.childNodes[range.endOffset] || nodeAfter(end)
  while (after.firstChild) after = after.firstChild
  if (after && after.nodeType == 3) sizeAfter = after.nodeValue.length

  return {before: before, sizeBefore,
          after: after, sizeAfter}
}

export function textInContext(context, deflt) {
  if (context.inside) {
    let val = context.inside.nodeValue
    return val.slice(context.lead, val.length - context.trail)
  } else {
    var before = context.before, after = context.after, val = ""
    if (!before) return deflt
    if (before.nodeType == 3)
      val = before.nodeValue.slice(context.sizeBefore)
    var scan = scanText(before, after)
    if (scan == null) return deflt
    val += scan
    if (after && after.nodeType == 3) {
      let valAfter = after.nodeValue
      val += valAfter.slice(0, valAfter.length - context.sizeAfter)
    }
    return val
  }
}

function nodeAfter(node) {
  for (;;) {
    let next = node.nextSibling
    if (next) {
      while (next.firstChild) next = next.firstChild
      return next
    }
    if (!(node = node.parentElement)) return null
  }
}

function nodeBefore(node) {
  for (;;) {
    let prev = node.previousSibling
    if (prev) {
      while (prev.lastChild) prev = prev.lastChild
      return prev
    }
    if (!(node = node.parentElement)) return null
  }
}

function scanText(start, end) {
  let text = "", cur = nodeAfter(start)
  for (;;) {
    if (cur == end) return text
    if (!cur) return null
    if (cur.nodeType == 3) text += cur.nodeValue
    cur = cur.firstChild || nodeAfter(cur)
  }
}
