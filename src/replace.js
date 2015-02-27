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

  if (repl) {
    if (start.cmp(end) != 0) {
      start = reduceRight(repl, start)
      end = reduceLeft(repl, end)
    }
    let collapsed = [0]
    let middle = slice.between(repl, start, end, collapsed)
    
    let endDepth = join_trackDepth(result, from.path.length, middle, start.path.length - collapsed[0])
    join_buildPosMap(result, end.path.length - collapsed[0] + endDepth, right, to.path.length)
  } else {
    join_buildPosMap(result, from.path.length, right, to.path.length)
  }
  return result
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
  join(left, leftDepth, right, rightDepth, function(_from, fromDepth, to, toDepth) {
    endDepth = toDepth - fromDepth
  })
  return endDepth
}

function join_buildPosMap(left, leftDepth, right, rightDepth) {
  let map = []
  join(left, leftDepth, right, rightDepth, function(_from, fromDepth, to, toDepth) {
    
  })
  return map
}
