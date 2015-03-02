// Basic block-based transformations

import Pos from "./pos"
import PosMap from "./posmap"
import * as slice from "./slice"
import * as join from "./join"

// FIXME kill empty parents
export function lift(doc, pos) {
  let block = pos.leaf(doc), parentDepth = -1
  for (let node = doc, i = 0; i < pos.path.length - 1; i++) {
    if (node.type.contains == block.type.type) parentDepth = i
    node = node.content[pos.path[i]]
  }
  if (parentDepth == -1) return noOp(doc)

  let last = pos.path.length - 1
  let posBefore = new Pos(pos.path.slice(0, last), pos.path[last], false)
  let posAfter = new Pos(posBefore.path, posBefore.offset + 1, false)
  let result = slice.before(doc, posBefore)
  let after = slice.after(doc, posAfter)

  let base = new Pos(pos.path, 0)
  let posMap = new PosMap(doc, base)

  let target = rightAtDepth(result, parentDepth)
  let prefix = pos.path.slice(0, parentDepth).concat(posBefore.offset)
  posMap.chunk(posAfter, input => new Pos(prefix, input.offset))

  target.content.push(block)
  join.buildPosMap(posMap, posAfter, result, parentDepth + 1, after, posAfter)

  return {map: posMap, doc: result}
}

function rightAtDepth(doc, depth) {
  for (var node = doc, i = 0; i < depth; i++)
    node = node.content[node.content.length - 1]
  return node
}

function noOp(doc) {
  return {doc: doc, map: new PosMap(doc, new Pos([], doc.content.length, false))}
}
