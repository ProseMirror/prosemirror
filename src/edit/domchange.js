import {findDiffStart, findDiffEnd} from "../model"
import {fromDOM} from "../format"
import {mapThroughResult} from "../transform/map"

import {findSelectionFrom} from "./selection"
import {DOMFromPos} from "./dompos"

export function readInputChange(pm) {
  pm.ensureOperation({readSelection: false})
  return readDOMChange(pm, rangeAroundSelection(pm), true)
}

export function readCompositionChange(pm, margin) {
  return readDOMChange(pm, rangeAroundComposition(pm, margin))
}

// Note that all referencing and parsing is done with the
// start-of-operation selection and document, since that's the one
// that the DOM represents. If any changes came in in the meantime,
// the modification is mapped over those before it is applied, in
// readDOMChange.

function parseBetween(pm, from, to) {
  let {node: parent, offset: startOff} = DOMFromPos(pm, from, true)
  let endOff = DOMFromPos(pm, to, true).offset
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
    preserveWhitespace: true,
    editableContent: true
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
  let {sel, doc} = pm.operation, $from = doc.resolve(sel.from), $to = doc.resolve(sel.to)
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
  let {sel, doc} = pm.operation
  let $from = doc.resolve(sel.from), $to = doc.resolve(sel.to)
  if (!$from.sameParent($to)) return rangeAroundSelection(pm)
  let startOff = Math.max(0, Math.min($from.parentOffset, $to.parentOffset) - margin)
  let size = $from.parent.content.size
  let endOff = Math.min(size, Math.max($from.parentOffset, $to.parentOffset) + margin)

  if (startOff > 0)
    startOff = $from.parent.childBefore(startOff).offset
  if (endOff < size) {
    let after = $from.parent.childAfter(endOff)
    endOff = after.offset + after.node.nodeSize
  }
  let nodeStart = $from.start($from.depth)
  return {from: nodeStart + startOff, to: nodeStart + endOff}
}

function readDOMChange(pm, range, detectEnter) {
  let op = pm.operation
  // If the document was reset since the start of the current
  // operation, we can't do anything useful with the change to the
  // DOM, so we discard it.
  if (op.docSet) {
    pm.markAllDirty()
    return false
  }

  let parsed = parseBetween(pm, range.from, range.to)
  let compare = op.doc.slice(range.from, range.to)
  let changeFrom = findDiffStart(compare.content, parsed.content, range.from)
  if (changeFrom == null) return false

  let changeTo = findDiffEndConstrained(compare.content, parsed.content, changeFrom,
                                        range.to, range.from + parsed.content.size)
  let fromMapped = mapThroughResult(op.mappings, changeFrom)
  let toMapped = mapThroughResult(op.mappings, changeTo.a)
  if (fromMapped.deleted && toMapped.deleted) return false

  // Mark nodes touched by this change as 'to be redrawn'
  markDirtyFor(pm, op.doc, changeFrom, changeTo.a)

  if (detectEnter) {
    let $from = parsed.resolveNoCache(changeFrom - range.from)
    let $to = parsed.resolveNoCache(changeTo.b - range.from), nextSel
    if (!$from.sameParent($to) && $from.pos < parsed.content.size &&
        (nextSel = findSelectionFrom(parsed, $from.pos + 1, 1, true)) &&
        nextSel.head == $to.pos)
      return {key: "Enter"}
  }
  let slice = parsed.slice(changeFrom - range.from, changeTo.b - range.from)
  return {transform: pm.tr.replace(fromMapped.pos, toMapped.pos, slice)}
}

function findDiffEndConstrained(a, b, start, endA, endB) {
  let end = findDiffEnd(a, b, endA, endB)
  if (!end) return end
  if (end.a < start) return {a: start, b: end.b + (start - end.a)}
  if (end.b < start) return {a: end.a + (start - end.b), b: start}
  return end
}

function markDirtyFor(pm, doc, start, end) {
  let $start = doc.resolve(start), $end = doc.resolve(end), same = $start.sameDepth($end)
  if (same == 0)
    pm.markAllDirty()
  else
    pm.markRangeDirty($start.before(same), $start.after(same), doc)
}
