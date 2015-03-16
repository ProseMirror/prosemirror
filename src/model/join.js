import Pos from "./pos"
import Node from "./node"
import * as style from "./style"
import {stitchTextNodes, inlineStylesAt} from "./inline"
import * as transform from "./transform"
import * as slice from "./slice"

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

function trackEnd(left, leftDepth, right, rightDepth) {
  let endPos, endPosInline
  simple(left, leftDepth, right, rightDepth, function(from, _fromDepth, to, toDepth) {
    let offset
    if (endPosInline = to.type.contains == "inline")
      offset = to.size + from.size
    else
      offset = to.content.length + from.content.length
    endPos = new Pos(pathRight(left, toDepth), offset)
  })
  return {pos: endPos, inline: endPosInline}
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

export function buildResult(result, base, left, leftDepth, right, rightPos, align) {
  let rightDepth = rightPos.path.length
  if (align)
    leftDepth = rightDepth = Math.min(leftDepth, rightDepth)
  simple(left, leftDepth, right, rightDepth, function(from, fromDepth, to, toDepth) {
    pushChunkToMap(result, base, fromDepth, nodeWidth(to), pathRight(left, toDepth))
  })
}

function findChunkEnd(doc, base, depth) {
  for (let i = 0, node = doc;; i++) {
    if (i == depth)
      return node.type.contains == "inline"
        ? new Pos(base.path, node.size)
        : new Pos(base.path.slice(0, i), node.content.length)
    node = node.content[base.path[i]]
  }
}

function pushChunkToMap(result, base, depth, offset, prefix) {
  result.chunk(findChunkEnd(result.before, base, depth), function(pos) {
    if (pos.cmp(base) < 0) pos = base
    let path = prefix.slice(0), extraOffset = offset
    for (let j = depth;; j++) {
      if (j == pos.path.length)
        return new Pos(path, pos.offset - base.offset + extraOffset)
      let diverging = pos.path[j] != base.path[j]
      let prevOffset = j == base.path.length ? base.offset : base.path[j] + (diverging ? 1 : 0)
      path.push(pos.path[j] - prevOffset + extraOffset)
      if (diverging)
        return new Pos(path.concat(pos.path.slice(j + 1)), pos.offset)
      
      extraOffset = 0
    }
  })
}

transform.define("replace", function(doc, params) {
  let from = params.pos, to = params.end || params.pos

  let output = slice.before(doc, from)
  let result = new transform.Result(doc, output, from)
  let right = slice.after(doc, to)

  if (params.source) {
    let start = params.from, end = params.to
    let collapsed = [0]
    let middle = slice.between(params.source, start, end, collapsed)

    let {pos: endPos, inline: endPosInline} =
        trackEnd(output, from.path.length, middle, start.path.length - collapsed[0]) || params.to
    let endDepth = endPos.path.length
    if (!endPosInline) endPos = Pos.end(output)
    result.chunk(to, _ => endPos)
    buildResult(result, to, output, end.path.length - collapsed[0] + endDepth, right, to)
  } else {
    let endPos = params.pos
    if (params.text) {
      let block = output.path(from.path), end = block.content.length
      if (!block.type.contains == "inline")
        throw new Error("Can not insert text at a non-inline position")
      let styles = block.type == Node.types.code_block ? params.styles || inlineStylesAt(doc, from) : Node.empty
      block.content.push(Node.text(params.text, styles))
      stitchTextNodes(block, end)
      endPos = new Pos(endPos.path, endPos.offset + params.text.length)
    }
    result.chunk(to, _ => endPos)
    buildResult(result, to, output, from.path.length, right, to)
  }

  return result
})
