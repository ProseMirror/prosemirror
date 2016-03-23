import {findDiffStart, findDiffEnd} from "../model"
import {fromDOM} from "../format"

import {findSelectionFrom} from "./selection"
import {DOMFromPos} from "./dompos"

function isAtEnd($pos, depth) {
  for (let i = depth || 0; i < $pos.depth; i++)
    if ($pos.index(i) + 1 < $pos.node(i).childCount) return false
  return $pos.parentOffset == $pos.parent.content.size
}
function isAtStart($pos, depth) {
  for (let i = depth || 0; i < $pos.depth; i++)
    if ($pos.index(0) > 0) return false
  return $pos.parentOffset == 0
}

function parseNearSelection(pm) {
  let {from, to} = pm.selection, $from = pm.doc.resolve(from), $to = pm.doc.resolve(to)
  for (let depth = 0;; depth++) {
    let fromStart = isAtStart($from, depth + 1), toEnd = isAtEnd($to, depth + 1)
    if (fromStart || toEnd || $from.index(depth) != $to.index(depth) || $to.node(depth).isTextblock) {
      let start = $from.before(depth + 1), end = $to.after(depth + 1)
      if (fromStart && $from.index(depth) > 0)
        start -= $from.node(depth).child($from.index(depth) - 1).nodeSize
      if (toEnd && $to.index(depth) + 1 < $to.node(depth).childCount)
        end += $to.node(depth).child($to.index(depth) + 1).nodeSize
      let startPos = DOMFromPos(pm.content, start), endPos = DOMFromPos(pm.content, end)
      while (startPos.offset) {
        let prev = startPos.node.childNodes[startPos.offset - 1]
        if (prev.nodeType != 1 || !prev.hasAttribute("pm-offset")) --startPos.offset
        else break
      }
      let parsed = fromDOM(pm.schema, startPos.node, {
        topNode: $from.node(depth).copy(),
        from: startPos.offset,
        to: endPos.offset,
        preserveWhitespace: true
      })

      let parentStart = $from.start(depth)
      parsed = parsed.copy($from.parent.content.cut(0, start - parentStart)
                           .append(parsed.content)
                           .append($from.parent.content.cut(end - parentStart)))
      for (let i = depth - 1; i >= 0; i--) {
        let wrap = $from.node(i)
        parsed = wrap.copy(wrap.content.replaceChild($from.index(i), parsed))
      }
      return parsed
    }
  }
}

export function readDOMChange(pm) {
  let updated = parseNearSelection(pm)
  let changeStart = findDiffStart(pm.doc.content, updated.content)
  if (changeStart != null) {
    let changeEnd = findDiffEndConstrained(pm.doc.content, updated.content, changeStart)
    // Mark nodes touched by this change as 'to be redrawn'
    markDirtyFor(pm, changeStart, changeEnd.a)

    let $start = updated.resolveNoCache(changeStart)
    let $end = updated.resolveNoCache(changeEnd.b), nextSel
    if (!$start.sameParent($end) && $start.pos < updated.content.size &&
        (nextSel = findSelectionFrom(updated, $start.pos + 1, 1, true)) &&
        nextSel.head == changeEnd.b)
      return {key: "Enter"}
    else
      return {transform: pm.tr.replace(changeStart, changeEnd.a, updated.slice(changeStart, changeEnd.b))}
  } else {
    return false
  }
}

function findDiffEndConstrained(a, b, start) {
  let end = findDiffEnd(a, b)
  if (!end) return end
  if (end.a < start) return {a: start, b: end.b + (start - end.a)}
  if (end.b < start) return {a: end.a + (start - end.b), b: start}
  return end
}

function markDirtyFor(pm, start, end) {
  let $start = pm.doc.resolve(start), $end = pm.doc.resolve(end), same = $start.sameDepth($end)
  if (same == 0)
    pm.markAllDirty()
  else
    pm.markRangeDirty($start.before(same), $start.after(same))
}

// Text-only queries for composition events

export function textContext(data) {
  let range = window.getSelection().getRangeAt(0)
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
