import Pos from "./pos"
import Node from "./node"
import * as slice from "./slice"
import * as join from "./join"
import * as transform from "./transform"

transform.define("replace", function(doc, params) {
  let origTo = params.end || params.pos
  let [from, to] = maybeReduce(doc, params.pos, origTo)

  let output = slice.before(doc, from)
  let result = new transform.Result(doc, output, from)
  let right = slice.after(doc, to)

  if (params.source) {
    let [start, end] = maybeReduce(params.source, params.from, params.to)
    let collapsed = [0]
    let middle = slice.between(params.source, start, end, collapsed)
    
    let endPos = join.trackEnd(output, from.path.length, middle, start.path.length - collapsed[0]) || params.to
    let endDepth = endPos.path.length
    if (!endPos.isBlock) endPos = Pos.end(output)
    result.chunk(origTo, _ => endPos)
    join.buildResult(result, origTo, output, end.path.length - collapsed[0] + endDepth, right, to)
  } else {
    result.chunk(origTo, _ => params.pos)
    join.buildResult(result, origTo, output, from.path.length, right, to)
  }

  return result
})

function maybeReduce(doc, from, to) {
  if (from.cmp(to) == 0) return [from, to]
  let newFrom = reduceRight(doc, from)
  let newTo = reduceLeft(doc, to)
  if (newFrom.cmp(newTo) >= 0) return [from, to]
  return [newFrom, newTo]
}

function reduceLeft(node, pos) {
  if (pos.offset) return pos

  let max = 0
  for (let i = 0; i < pos.path.length; i++)
    if (pos.path[i]) max = i
  return new Pos(pos.path.slice(0, max), pos.path[max], false)
}

function reduceRight(node, pos) {
  let max = 0
  for (let i = 0; i < pos.path.length; i++) {
    let n = pos.path[i]
    if (n < node.content.length - 1) max = i
    node = node.content[pos.path[i]]
  }
  if (pos.offset < node.size) return pos
  return new Pos(pos.path.slice(0, max), pos.path[max] + 1, false)
}
