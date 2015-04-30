import {fromDOM, Node, Pos, findDiffStart, findDiffEnd} from "../model"
import {T} from "../transform"

import {findByPath} from "./selection"

// FIXME maybe find some heuristic to avoid parsing the whole DOM?

export function applyDOMChange(pm) {
  let updated = fromDOM(pm.content)
  let changeStart = findDiffStart(pm.doc, updated)
  if (changeStart) {
    let changeEnd = findDiffEndConstrained(pm.doc, updated, changeStart)
    pm.apply(pm.tr.replace(changeStart.a, changeEnd.a, updated, changeStart.b, changeEnd.b))
    pm.operation.fullRedraw = true
    return true
  } else {
    return false
  }
}

function offsetBy(first, second, paths) {
  for (let i = 0; i < first.path.length; i++) {
    let diff = second.path[i] - first.path[i]
    if (diff)
      return {a: paths.a.offsetAt(i, diff), b: paths.b.offsetAt(i, diff)}
  }
  let diff = second.offset - first.offset
  return {a: paths.a.shift(diff), b: paths.b.shift(diff)}
}

function findDiffEndConstrained(a, b, start) {
  let end = findDiffEnd(a, b)
  if (!end) return end
  if (end.a.cmp(start.a) < 0) return offsetBy(end.a, start.a, end)
  if (end.b.cmp(start.b) < 0) return offsetBy(end.b, start.b, end)
  return end
}
