import {Pos, Node, style, inline, slice} from "../model"
import {defineTransform, Result} from "./transform"

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

export function join(left, leftDepth, right, rightDepth, f) {
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
          inline.stitchTextNodes(other, start)
        iLeft = i - 1
        if (iRight) rightNodes[iRight - 1].remove(node)
        break
      }
    }
  }
}

function trackEnd(left, leftDepth, right, rightDepth) {
  let endPos, endPosInline
  join(left, leftDepth, right, rightDepth, function(from, _fromDepth, to, toDepth) {
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

export function joinAndTrack(result, base, left, leftDepth, right, rightPos, align) {
  let rightDepth = rightPos.path.length
  let spine = []
  for (let i = 0, node = right; i <= rightDepth; i++) {
    spine.push(node)
    node = node.content[0]
  }

  if (align)
    leftDepth = rightDepth = Math.min(leftDepth, rightDepth)

  join(left, leftDepth, right, rightDepth, function(from, fromDepth, to, toDepth) {
    let pathToOutput = pathRight(left, toDepth)
    while (fromDepth < spine.length) {
      let  node = spine.pop(), len = spine.length
      while (base.path.length > len) base = base.shorten()
      if (fromDepth < len && base.offset == 0) continue
      let inline = node.type.contains == "inline"

      let newStart
      if (fromDepth < len) {
        let newPath = pathToOutput.slice()
        newPath.push(inline ? to.size : to.content.length)
        for (let i = fromDepth + 1; i < len; i++) newPath.push(0)
        newStart = new Pos(newPath, 0)
      } else {
        newStart = new Pos(pathToOutput, inline ? to.size : to.content.length)
      }

      result.chunk(base, inline ? node.size : node.content.length, newStart)
    }
  })
}

defineTransform("replace", function(doc, params) {
  let from = params.pos, to = params.end || params.pos

  let output = slice.before(doc, from)
  let result = new Result(doc, output, from)
  let right = slice.after(doc, to)

  if (params.source) {
    let start = params.from, end = params.to
    let collapsed = [0]
    let middle = slice.between(params.source, start, end, collapsed)

    let {pos: endPos, inline: endPosInline} =
        trackEnd(output, from.path.length, middle, start.path.length - collapsed[0]) || params.to
    let endDepth = endPos.path.length
    joinAndTrack(result, to, output, end.path.length - collapsed[0] + endDepth, right, to)
  } else {
    if (params.text) {
      let block = output.path(from.path), end = block.content.length
      if (!block.type.contains == "inline")
        throw new Error("Can not insert text at a non-inline position")
      let styles = block.type != Node.types.code_block ? params.styles || inline.inlineStylesAt(doc, from) : Node.empty
      block.content.push(Node.text(params.text, styles))
      inline.stitchTextNodes(block, end)
    }
    joinAndTrack(result, to, output, from.path.length, right, to)
  }

  return result
})
