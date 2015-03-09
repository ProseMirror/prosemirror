import Pos from "./pos"
import Node from "./node"
import * as style from "./style"

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
      style.sameSet(before.styles, after.styles)) {
    let joined = new Node.Inline(Node.types.text, before.styles, before.text + after.text)
    node.content.splice(at - 1, 2, joined)
  }
}

export function simple(left, leftDepth, right, rightDepth, f) {
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
      if (compatibleTypes(node.type, other.type) && (iRight > 0 || i == 0)) {
        if (f) f(node, iRight, other, i)
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

export function trackDepth(left, leftDepth, right, rightDepth) {
  let endDepth = 0
  simple(left, leftDepth, right, rightDepth, function(_from, fromDepth, _to, toDepth) {
    endDepth = toDepth - fromDepth
  })
  return endDepth
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

export function buildTransform(transform, base, left, leftDepth, right, rightPos, align) {
  let rightDepth = rightPos.path.length
  if (align)
    leftDepth = rightDepth = Math.min(leftDepth, rightDepth)
  simple(left, leftDepth, right, rightDepth, function(from, fromDepth, to, toDepth) {
    pushChunkToMap(transform, base, fromDepth, nodeWidth(to), pathRight(left, toDepth))
  })
}

function findChunkEnd(doc, base, depth) {
  for (let i = 0, node = doc;; i++) {
    if (i == depth)
      return node.type.contains == "inline"
        ? new Pos(base.path, node.size)
        : new Pos(base.path.slice(0, i), node.content.length, false)
    node = node.content[base.path[i]]
  }
}

function pushChunkToMap(transform, base, depth, offset, prefix) {
  transform.chunk(findChunkEnd(transform.before, base, depth), function(pos) {
    if (pos.cmp(base) < 0) pos = base
    let path = prefix.slice(0), extraOffset = offset
    for (let j = depth;; j++) {
      if (j == pos.path.length)
        return new Pos(path, pos.offset - base.offset + extraOffset)
      let prevOffset = j == base.path.length ? base.offset : base.path[j]
      path.push(pos.path[j] - prevOffset + extraOffset)
      if (pos.path[j] != base.path[j])
        return new Pos(path.concat(pos.path.slice(j + 1)), pos.offset)
      extraOffset = 0
    }
  })
}
