import {findDiffStart, findDiffEnd} from "../model"
import {fromDOM} from "../format"

import {findSelectionFrom} from "./selection"
import {DOMFromPos} from "./dompos"

export function readInputChange(pm) {
  return readDOMChange(pm, rangeAroundSelection(pm), true)
}

export function readCompositionChange(pm, margin) {
  return readDOMChange(pm, rangeAroundComposition(pm, margin))
}

function parseBetween(pm, from, to) {
  let {node: parent, offset: startOff} = DOMFromPos(pm, from)
  let endOff = DOMFromPos(pm, to).offset
  while (startOff) {
    let prev = parent.childNodes[startOff - 1]
    if (prev.nodeType != 1 || !prev.hasAttribute("pm-offset")) --startOff
    else break
  }
  while (endOff < parent.childNodes.length) {
    let next = parent.childNodes[endOff]
    if (next.nodeType != 1 || !next.hasAttribute("pm-offset")) ++endOff
    else break
  }
  return fromDOM(pm.schema, parent, {
    topNode: pm.doc.resolve(from).parent.copy(),
    from: startOff,
    to: endOff,
    preserveWhitespace: true
  })
}

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

// FIXME special case for inside-single-textblock-not-at-sides situation
// (To avoid re-parsing huge textblocks for tiny changes)
function rangeAroundSelection(pm) {
  let {from, to} = pm.selection, $from = pm.doc.resolve(from), $to = pm.doc.resolve(to)
  for (let depth = 0;; depth++) {
    let fromStart = isAtStart($from, depth + 1), toEnd = isAtEnd($to, depth + 1)
    if (fromStart || toEnd || $from.index(depth) != $to.index(depth) || $to.node(depth).isTextblock) {
      let from = $from.before(depth + 1), to = $to.after(depth + 1)
      if (fromStart && $from.index(depth) > 0)
        from -= $from.node(depth).child($from.index(depth) - 1).nodeSize
      if (toEnd && $to.index(depth) + 1 < $to.node(depth).childCount)
        to += $to.node(depth).child($to.index(depth) + 1).nodeSize
      return {from, to}
    }
  }
}

function rangeAroundComposition(pm, margin) {
  let $from = pm.doc.resolve(pm.selection.from), $to = pm.doc.resolve(pm.selection.to)
  if (!$from.sameParent($to)) return rangeAroundSelection(pm)
  let startOff = Math.max(0, Math.min($from.parentOffset, $to.parentOffset) - margin)
  let size = $from.parent.content.size
  let endOff = Math.min(size, Math.max($from.parentOffset, $to.parentOffset) + margin)

  if (startOff > 0)
    startOff = $from.parent.nodeBefore(startOff).offset
  if (endOff < size) {
    let after = $from.parent.nodeAfter(endOff)
    endOff = after.offset + after.node.nodeSize
  }
  let nodeStart = $from.start($from.depth)
  return {from: nodeStart + startOff, to: nodeStart + endOff}
}

function readDOMChange(pm, range, detectEnter) {
  let parsed = parseBetween(pm, range.from, range.to)
  let compare = pm.doc.slice(range.from, range.to)
  let changeFrom = findDiffStart(compare.content, parsed.content, range.from)
  if (changeFrom == null) return false

  let changeTo = findDiffEndConstrained(compare.content, parsed.content, changeFrom,
                                        range.to, range.from + parsed.content.size)
  // Mark nodes touched by this change as 'to be redrawn'
  markDirtyFor(pm, changeFrom, changeTo.a)

  if (detectEnter) {
    let $from = parsed.resolveNoCache(changeFrom - range.from)
    let $to = parsed.resolveNoCache(changeTo.b - range.from), nextSel
    if (!$from.sameParent($to) && $from.pos < parsed.content.size &&
        (nextSel = findSelectionFrom(parsed, $from.pos + 1, 1, true)) &&
        nextSel.head == $to.pos)
      return {key: "Enter"}
  }
  let slice = parsed.slice(changeFrom - range.from, changeTo.b - range.from)
  return {transform: pm.tr.replace(changeFrom, changeTo.a, slice)}
}

function findDiffEndConstrained(a, b, start, endA, endB) {
  let end = findDiffEnd(a, b, endA, endB)
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
