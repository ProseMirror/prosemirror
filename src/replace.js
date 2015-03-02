import Pos from "./pos"
import Node from "./node"
import * as slice from "./slice"

export default function replace(doc, from, to, repl = null, start = null, end = null) {
  if (from.cmp(to) != 0) {
    from = reduceRight(doc, from)
    to = reduceLeft(doc, to)
  }
  let result = slice.before(doc, from)
  let right = slice.after(doc, to)
  let chunkMap, newTo

  if (repl) {
    if (start.cmp(end) != 0) {
      start = reduceRight(repl, start)
      end = reduceLeft(repl, end)
    }
    let collapsed = [0]
    let middle = slice.between(repl, start, end, collapsed)
    
    let endDepth = join_trackDepth(result, from.path.length, middle, start.path.length - collapsed[0])
    newTo = lastBlockPos(result)
    chunkMap = join_buildChunkMap(result, end.path.length - collapsed[0] + endDepth, right, to)
  } else {
    newTo = lastBlockPos(result)
    chunkMap = join_buildChunkMap(result, from.path.length, right, to)
  }
  return {map: buildPosMap(from, to, newTo, chunkMap),
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

function nodesLeft(doc, depth) {
  let nodes = []
  for (let node = doc, i = 0;; i++) {
    nodes.push(node)
    if (i == depth) return nodes
    node = node.content[0]
  }
}

function nodesRight(doc, depth) {
  let nodes = []
  for (let node = doc, i = 0;; i++) {
    nodes.push(node)
    if (i == depth) return nodes
    node = node.content[node.content.length - 1]
  }
}

function compatibleTypes(a, b) {
  return a.contains == b.contains &&
    (a.contains == "block" || a.contains == "inline" || a == b)
}

function stitchTextNodes(node, at) {
  let before, after
  if (at && node.content.length > at &&
      (before = node.content[at - 1]).type == Node.types.text &&
      (after = node.content[at]).type == Node.types.text &&
      Node.styles.same(before.styles, after.styles)) {
    let joined = new Node.Inline(Node.types.text, before.styles, before.text + after.text)
    node.content.splice(at - 1, 2, joined)
  }
}

function join(left, leftDepth, right, rightDepth, f) {
  let leftNodes = nodesRight(left, leftDepth)
  let rightNodes = nodesLeft(right, rightDepth)
  for (let iLeft = leftNodes.length - 1,
           iRight = rightNodes.length - 1; iRight >= 0; iRight--) {
    let node = rightNodes[iRight];
    if (node.content.length == 0) {
      if (iRight) rightNodes[iRight - 1].remove(node)
      continue
    }
    for (let i = iLeft; i >= 0; i--) {
      let other = leftNodes[i]
      if (compatibleTypes(node.type, other.type) && (i > 0 || iRight == 0)) {
        f(node, iRight, other, i)
        let start = other.content.length
        other.pushFrom(node)
        if (node.type.contains == "inline")
          stitchTextNodes(other, start)
        iLeft = i - 1
        if (iRight) rightNodes[iRight - 1].remove(node)
        break
      }
    }
  }
}

function join_trackDepth(left, leftDepth, right, rightDepth) {
  let endDepth = 0
  join(left, leftDepth, right, rightDepth, function(_from, fromDepth, _to, toDepth) {
    endDepth = toDepth - fromDepth
  })
  return endDepth
}

function searchLastBlockPos(node, path) {
  if (node.type.contains == "inline")
    return new Pos(path, node.size)
  for (let i = node.content.length - 1; i >= 0; i--) {
    path.push(i)
    let found = searchLastBlockPos(node.content[i], path)
    if (found) return found
    path.pop(i)
  }
}

function lastBlockPos(doc) {
  let found = searchLastBlockPos(doc, [])
  if (!found) throw new Error("No block position in doc " + doc)
  return found
}

function offsetAt(pos, depth) {
  return depth == pos.path.length ? pos.offset : pos.path[depth]
}

function pathRight(node, depth) {
  if (depth == 0) return []
  let offset = node.content.length - 1
  let inner = pathRight(node.content[offset], depth - 1)
  inner.unshift(offset)
  return inner
}

function nodeWidth(node) {
  return node.type.contains == "inline" ? node.size : node.content.length
}

function join_buildChunkMap(left, leftDepth, right, rightPos) {
  let map = []
  join(left, leftDepth, right, rightPos.path.length, function(from, fromDepth, to, toDepth) {
    map.push({start: lastBlockPos(left),
              depth: fromDepth,
              offsetDiff: offsetAt(rightPos, fromDepth) - nodeWidth(to),
              prefix: pathRight(left, toDepth)})
  })
  return map
}

function buildPosMap(from, to, newTo, chunkMap) {
  return function(pos) {
    if (from.cmp(pos) <= 0) return pos
    if (to.cmp(pos) <= 0) return newTo
    for (let i = chunkMap.length - 1; i >= 0; i--) {
      let chunk = chunkMap[i]
      if (chunk.start.cmp(pos) >= 0) {
        if (chunk.depth == pos.path.length) {
          return new Pos(chunk.prefix, pos.offset + chunk.offsetDiff)
        } else {
          let join = pos.path[chunk.depth] + chunk.offsetDiff
          return new Pos(chunk.prefix.concat(join).concat(pos.path.slice(chunk.depth + 1)), pos.offset)
        }
      }
    }
    return newTo
  }
}
