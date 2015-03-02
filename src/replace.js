import Pos from "./pos"
import Node from "./node"
import * as slice from "./slice"
import * as join from "./join"

export default function replace(doc, from, to, repl = null, start = null, end = null) {
  let origFrom = from, origTo = to
  if (from.cmp(to) != 0) {
    from = reduceRight(doc, from)
    to = reduceLeft(doc, to)
  }
  let result = slice.before(doc, from)
  let right = slice.after(doc, to)
  let chunkMap, collapsed = [0]

  if (repl) {
    if (start.cmp(end) != 0) {
      start = reduceRight(repl, start)
      end = reduceLeft(repl, end)
    }
    let middle = slice.between(repl, start, end, collapsed)
    
    let endDepth = join.trackDepth(result, from.path.length, middle, start.path.length - collapsed[0])
    chunkMap = join.buildChunkMap(result, end.path.length - collapsed[0] + endDepth, right, to)
  } else {
    chunkMap = join.buildChunkMap(result, from.path.length, right, to)
  }
  return {map: join.buildPosMap(doc, origFrom, origTo, chunkMap, collapsed[0]),
          doc: result}
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
