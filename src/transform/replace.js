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

export function glue(left, leftDepth, right, rightBorder, onChunk, align) {
  let rightDepth = rightBorder.path.length
  let cutDepth = 0
  if (align) {
    cutDepth = Math.max(0, rightDepth - leftDepth)
    leftDepth = rightDepth = Math.min(leftDepth, rightDepth)
  }
  let leftNodes = nodesRight(left, leftDepth)
  let rightNodes = nodesLeft(right, rightDepth)

  for (let iLeft = leftNodes.length - 1,
           iRight = rightNodes.length - 1; iRight >= 0; iRight--) {
    let node = rightNodes[iRight]
    if (node.content.length == 0) {
      if (iRight) rightNodes[iRight - 1].remove(node)
      continue
    }
    let found, target
    for (let i = iLeft; i >= 0; i--) {
      target = leftNodes[i]
      if (compatibleTypes(node.type, target.type) && (iRight > 0 || i == 0)) {
        found = i
        break
      }
    }
    if (found != null) {
      if (onChunk) for (let depth = cutDepth; depth >= 0; depth--) {
        while (rightBorder.path.length > iRight + depth) rightBorder = rightBorder.shorten()
        if (depth && rightBorder.offset == 0) continue

        let pathToOutput = pathRight(left, found)
        let cur = node
        for (let i = 0; i < depth; i++) cur = cur.content[0]
        let inline = cur.type.contains == "inline"

        let newStart, targetSize = inline ? target.size : target.content.length
        let chunkSize = inline ? cur.size : cur.content.length
        if (depth) {
          pathToOutput.push(targetSize)
          for (let i = 1; i < depth; i++) pathToOutput.push(0)
          newStart = new Pos(pathToOutput, 0)
        } else {
          newStart = new Pos(pathToOutput, targetSize)
        }
        if (onChunk.chunk) onChunk.chunk(rightBorder, chunkSize, newStart)
        else onChunk(rightBorder, chunkSize, newStart)
      }

      let start = target.content.length
      target.pushFrom(node)
      if (node.type.contains == "inline")
        inline.stitchTextNodes(target, start)

      iLeft = found - 1
      cutDepth = 0
      if (iRight) rightNodes[iRight - 1].remove(node)
    } else {
      ++cutDepth
    }
  }
}

function pathRight(node, depth) {
  if (depth == 0) return []
  let offset = node.content.length - 1
  let inner = pathRight(node.content[offset], depth - 1)
  inner.unshift(offset)
  return inner
}

function addDeletedChunksAfter(result, node, pos, depth) {
  if (depth == pos.path.length) {
    result.chunkDeleted(pos, (node.type.contains == "inline" ? node.size : node.content.length) - pos.offset)
  } else {
    let n = pos.path[depth]
    addDeletedChunksAfter(result, node.content[n], pos, depth + 1)
    let size =  node.content.length - n - 1
    if (size)
      result.chunkDeleted(new Pos(pos.path.slice(0, depth), n + 1), size)
  }
}

function addDeletedChunksBefore(result, node, pos, depth) {
  if (depth == pos.path.lengh) {
    result.chunkDeleted(new Pos(pos.path, 0), pos.offset)
  } else {
    let n = pos.path[depth]
    if (n)
      result.chunkDeleted(new Pos(pos.path.slice(0, depth), 0), n)
    addDeletedChunksBefore(result, node.content[n], pos, depth + 1)
  }    
}

function addDeletedChunks(result, node, from, to, depth = 0) {
  var fromEnd = depth == from.path.length, toEnd = depth == to.path.length
  if (!fromEnd && !toEnd && from.path[depth] == to.path[depth]) {
    addDeletedChunks(result, node.content[from.path[depth]], from, to, depth + 1)
  } else if (fromEnd && toEnd) {
    if (to.offset != from.offset)
      result.chunkDeleted(from, to.offset - from.offset)
  } else {
    let start = from.offset
    if (!fromEnd) {
      start = from.path[depth] + 1
      addDeletedChunksAfter(result, node, from, depth + 1)
    }
    let end = toEnd ? to.offset : to.path[depth]
    if (end != start)
      result.chunkDeleted(new Pos(from.path.slice(0, depth), start), end - start)
    if (!toEnd)
      addDeletedChunksAfter(result, node, to, depth + 1)
  }
}

defineTransform("replace", function(doc, params) {
  let from = params.pos, to = params.end || params.pos

  let output = slice.before(doc, from)
  let result = new Result(doc, output, from)
  let right = slice.after(doc, to)
  addDeletedChunks(result, doc, from, to)

  if (params.source) {
    let start = params.from, end = params.to
    let middle = slice.between(params.source, start, end, false)

    let depthOffset = 0
    glue(output, from.path.length, middle, start, (oldPos, _, newPos) => {
      depthOffset = newPos.path.length - oldPos.path.length
    })
    glue(output, end.path.length + depthOffset, right, to, result)
  } else {
    if (params.text) {
      let block = output.path(from.path), end = block.content.length
      if (!block.type.contains == "inline")
        throw new Error("Can not insert text at a non-inline position")
      let styles = block.type != Node.types.code_block ? params.styles || inline.inlineStylesAt(doc, from) : Node.empty
      block.content.push(Node.text(params.text, styles))
      inline.stitchTextNodes(block, end)
    }
    glue(output, from.path.length, right, to, result)
  }

  return result
})
