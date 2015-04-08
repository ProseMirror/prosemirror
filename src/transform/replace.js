import {Pos, Node, style, inline, slice} from "../model"
import {Collapsed, defineTransform, Result, flatTransform} from "./transform"
import {resolvePos, describePos} from "./resolve"

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

function compatibleTypes(a, aDepth, b, bDepth, options) {
  if (a.contains != b.contains) return false
  if (options.liberal)
    return a.contains == "block" || a.contains == "inline" || a == b
  else
    return a.contains == "inline" || a == b && aDepth == bDepth
}

// FIXME kill styles in code blocks

export function glue(left, leftDepth, right, rightBorder, options = {}) {
  let rightDepth = rightBorder.path.length
  let cutDepth = 0
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
      if (compatibleTypes(node.type, iRight, target.type, i, options)) {
        found = i
        break
      }
    }
    if (found != null) {
      if (options.result || options.onChunk) for (let depth = cutDepth; depth >= 0; depth--) {
        while (rightBorder.path.length > iRight + depth) rightBorder = rightBorder.shorten(null, 1)
        if (depth && rightBorder.offset == 0) continue

        let cur = node
        for (let i = 0; i < depth; i++) cur = cur.content[0]
        let newStart = posRight(left, found)
        if (depth) {
          newStart.path.push(newStart.offset)
          for (let i = 1; i < depth; i++) newStart.path.push(0)
          newStart.offset = 0
        }
        if (options.result)
          options.result.chunk(rightBorder, cur.maxOffset, newStart)
        if (options.onChunk)
          options.onChunk(rightBorder, cur.maxOffset, newStart)
      }

      if (node.type.contains == "inline") {
        let start = target.content.length
        if (options.inheritStyles) {
          let styles = inline.inlineStylesAt(target, new Pos([], target.size))
          for (let i = 0; i < node.content.length; i++) {
            let child = node.content[i]
            target.push(new Node.Inline(child.type, styles, child.text, child.attrs))
          }
        } else {
          target.pushFrom(node)
        }
        inline.stitchTextNodes(target, start)
      } else {
        target.pushFrom(node)
      }

      iLeft = found - 1
      cutDepth = 0
      if (iRight) rightNodes[iRight - 1].remove(node)
    } else {
      ++cutDepth
    }
  }
}

function posRight(node, depth) {
  let path = []
  for (let i = 0; i < depth; i++) {
    let offset = node.content.length - 1
    path.push(offset)
    node = node.content[offset]
  }
  return new Pos(path, node.maxOffset)
}

function addDeletedChunksAfter(del, node, pos, depth) {
  if (depth == pos.path.length) {
    del.chunk(pos, node.maxOffset - pos.offset)
  } else {
    let n = pos.path[depth]
    addDeletedChunksAfter(del, node.content[n], pos, depth + 1)
    let size = node.content.length - n - 1
    if (size)
      del.chunk(new Pos(pos.path.slice(0, depth), n + 1), size)
  }
}

function addDeletedChunksBefore(del, node, pos, depth) {
  if (depth == pos.path.length) {
    del.chunk(new Pos(pos.path, 0), pos.offset)
  } else {
    let n = pos.path[depth]
    if (n) del.chunk(new Pos(pos.path.slice(0, depth), 0), n)
    addDeletedChunksBefore(del, node.content[n], pos, depth + 1)
  }    
}

function addDeletedChunks(del, node, from, to, depth = 0) {
  var fromEnd = depth == from.path.length, toEnd = depth == to.path.length
  if (!fromEnd && !toEnd && from.path[depth] == to.path[depth]) {
    addDeletedChunks(del, node.content[from.path[depth]], from, to, depth + 1)
  } else if (fromEnd && toEnd) {
    del.chunk(from, to.offset - from.offset)
  } else {
    let start = from.offset
    if (!fromEnd) {
      start = from.path[depth] + 1
      addDeletedChunksAfter(del, node.content[start - 1], from, depth + 1)
    }
    let end = toEnd ? to.offset : to.path[depth]
    if (end != start)
      del.chunk(new Pos(from.path.slice(0, depth), start), end - start)
    if (!toEnd)
      addDeletedChunksBefore(del, node.content[end], to, depth + 1)
  }
}

function replace(doc, params) {
  let from = resolvePos(doc, params.pos, params.posInfo)
  let to = params.end ? resolvePos(doc, params.end, params.endInfo) : from
  if (!from || !to || (!params.source && !from.cmp(to))) return flatTransform(doc)

  let output = slice.before(doc, from)
  let result = new Result(doc, output)
  let right = slice.after(doc, to)
  let depthAfter

  if (params.source) {
    let start = params.from, end = params.to
    let middle = slice.between(params.source, start, end, false)

    let middleChunks = []
    glue(output, from.path.length, middle, start, {
      onChunk: (before, size, after) => {
        middleChunks.push({before: before, size: size, after: after})
      },
      liberal: true,
      inheritStyles: params.inheritStyles
    })
    depthAfter = end.path.length
    result.inserted = new Collapsed(from, null, Pos.after(doc, to))
    for (let i = 0; i < middleChunks.length; i++) {
      let chunk = middleChunks[i]
      let start = chunk.after, size = chunk.size
      if (i == middleChunks.length - 1) {
        depthAfter += chunk.after.path.length - chunk.before.path.length
        for (let depth = chunk.before.path.length + 1; depth <= end.path.length; depth++) {
          result.inserted.chunk(start, size - 1)
          start = new Pos(start.path.concat(start.offset + size - 1), 0)
          size = depth == end.path.length ? end.offset : end.path[depth]
        }
      }
      result.inserted.chunk(start, size)
    }
    result.inserted.to = Pos.end(output) // FIXME is this robust?
  } else {
    depthAfter = from.path.length
  }

  let deletedEnd = posRight(output, depthAfter)
  glue(output, depthAfter, right, to, {result: result})
  result.deleted = new Collapsed(from, to, Pos.after(output, deletedEnd))
  addDeletedChunks(result.deleted, doc, from, to)

  return result
}

defineTransform("replace", {
  apply: replace,
  invert(result, params) {
    let pos = result.map(params.pos)
    return {name: "replace", pos: result.inserted ? result.inserted.from : pos, end: pos,
            source: result.before, from: params.pos, to: params.end || params.pos}
  }
})

function addPositions(doc, params, pos, end, from) {
  let posDesc = describePos(doc, pos, from || "right")
  ;({pos: params.pos, info: params.posInfo}) = posDesc
  ;({pos: params.end, info: params.endInfo}) = end ? describePos(doc, end, from || "left") : posDesc
  return params
}

export function insertNode(doc, pos, options, node) {
  let node = node || options && options.node
  if (!node) {
    let type = Node.types[options.type]
    if (type.type == "inline")
      node = new Node.Inline(type, options.styles, null, options.attrs)
    else
      node = new Node(type, null, options.attrs)
  }
  let inline = node.type.type == "inline"
  let size = inline ? node.size : 1
  let wrap = Node.findConnection(Node.types.doc, node.type)
  let path = []
  for (let i = wrap.length - 1; i >= 0; i--) {
    node = new Node(wrap[i], [node])
    path.push(0)
  }
  let params = {name: "replace", source: new Node("doc", [node]),
                from: new Pos(path, 0), to: new Pos(path, size)}
  if (!options || !options.styles && inline)
    params.inheritStyles = true
  if (doc) {
    addPositions(doc, params, pos, options.end)
  } else {
    ;[params.pos, params.end] = [pos, options.end]
  }
  return params
}

export function insertText(pos, text, options) {
  return insertNode(options && options.doc, pos, options,
                    new Node.text(text, options && options.styles))
}

export function remove(doc, pos, end, options) {
  return addPositions(doc, {name: "replace"}, pos, end, options && options.from)
}

export function removeNode(doc, path, options) {
  let before = Pos.shorten(path), after = Pos.shorten(path, null, 1)
  return addPositions(doc, {name: "replace"}, before, after, options && options.from)
}

function joinPoint(doc, pos, allowInline) {
  let joinDepth = -1
  for (let i = 0, parent = doc; i <= pos.path.length; i++) {
    let index = i == pos.path.length ? pos.offset : pos.path[i]
    let type = parent.content[index].type
    if (index > 0 && parent.content[index - 1].type == type &&
        (allowInline || type.contains != "inline"))
      joinDepth = i
    parent = parent.content[index]
  }
  if (joinDepth > -1)
    return joinDepth == pos.path.length ? pos : pos.shorten(joinDepth)
}

export function joinNodes(doc, pos, options) {
  let point = joinPoint(doc, pos, options && options.allowInline)
  if (!point) return null
  let leftPath = point.path.concat(point.offset - 1)
  let left = new Pos(leftPath, doc.path(leftPath).maxOffset)
  let right = new Pos(point.path.concat(point.offset), 0)
  return remove(doc, left, right)
}
