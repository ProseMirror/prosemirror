import {Pos, Node, Span, stitchTextNodes, spanStylesAt, sliceBefore,
        sliceAfter, sliceBetween} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {PosMap, MovedRange, ReplacedRange} from "./map"
import {copyTo, replaceHasEffect, samePathDepth} from "./tree"

function findMovedChunks(oldNode, oldPath, newNode, startDepth) {
  let moved = []
  let newPath = oldPath.path.slice(0, startDepth)

  for (let depth = startDepth;; depth++) {
    let joined = depth == oldPath.depth ? 0 : 1
    let cut = depth == oldPath.depth ? oldPath.offset : oldPath.path[depth]
    let afterCut = oldNode.maxOffset - cut
    let newOffset = newNode.maxOffset - afterCut

    let from = oldPath.shorten(depth, joined)
    let to = new Pos(newPath, newOffset + joined)
    if (from.cmp(to)) moved.push(new MovedRange(from, afterCut - joined, to))

    if (!joined) return moved

    oldNode = oldNode.content[cut]
    newNode = newNode.content[newOffset]
    newPath = newPath.concat([newOffset])
  }
}

export function replace(node, from, to, root, repl, depth = 0) {
  if (depth == root.length) {
    let before = sliceBefore(node, from, depth)
    let after = sliceAfter(node, to, depth), result
    if (repl.nodes.length)
      result = before.append(repl.nodes, Math.min(repl.openLeft, from.depth - depth))
                     .append(after.content, Math.min(repl.openRight, to.depth - depth))
    else
      result = before.append(after.content, Math.min(to.depth, from.depth) - depth)
    return {doc: result, moved: findMovedChunks(node, to, result, depth)}
  } else {
    let pos = root[depth]
    let {doc, moved} = replace(node.content[pos], from, to, root, repl, depth + 1)
    return {doc: node.replace(pos, doc), moved}
  }
}

const nullRepl = {nodes: [], openLeft: 0, openRight: 0}

defineStep("replace", {
  apply(doc, step) {
    let rootPos = step.pos, root = rootPos.path
    if (step.from.depth < root.length || step.to.depth < root.length)
      return null
    for (let i = 0; i < root.length; i++)
      if (step.from.path[i] != root[i] || step.to.path[i] != root[i])
        return null

    let result = replace(doc, step.from, step.to, rootPos.path, step.param || nullRepl)
    if (!result) return null
    let {doc: out, moved} = result
    let end = moved.length ? moved[moved.length - 1].dest : step.to
    let replaced = new ReplacedRange(step.from, step.to, step.from, end, rootPos, rootPos)
    return new TransformResult(out, new PosMap(moved, [replaced]))
  },
  invert(step, oldDoc, map) {
    let depth = step.pos.depth
    let between = sliceBetween(oldDoc, step.from, step.to, false)
    for (let i = 0; i < depth; i++) between = between.content[0]
    return new Step("replace", step.from, map.map(step.to).pos, step.from.shorten(depth), {
      nodes: between.content,
      openLeft: step.from.depth - depth,
      openRight: step.to.depth - depth
    })
  },
  paramToJSON(param) {
    return param && {nodes: param.nodes && param.nodes.map(n => n.toJSON()),
                     openLeft: param.openLeft, openRight: param.openRight}
  },
  paramFromJSON(json) {
    return json && {nodes: json.nodes && json.nodes.map(Node.fromJSON),
                    openLeft: json.openLeft, openRight: json.openRight}
  }
})

function buildInserted(nodesLeft, source, start, end) {
  let sliced = sliceBetween(source, start, end, false)
  let nodesRight = []
  for (let node = sliced, i = 0; i <= start.path.length; i++, node = node.content[0])
    nodesRight.push(node)
  let same = samePathDepth(start, end)
  let searchLeft = nodesLeft.length - 1, searchRight = nodesRight.length - 1
  let result = null

  let inner = nodesRight[searchRight]
  if (inner.type.block && inner.size && nodesLeft[searchLeft].type.block) {
    result = nodesLeft[searchLeft--].copy(inner.content)
    nodesRight[--searchRight].content.shift()
  }

  for (;;) {
    let node = nodesRight[searchRight], type = node.type, matched = null
    let outside = searchRight <= same
    for (let i = searchLeft; i >= 0; i--) {
      let left = nodesLeft[i]
      if (outside ? left.type.contains == type.contains : left.type == type) {
        matched = i
        break
      }
    }
    if (matched != null) {
      if (!result) {
        result = nodesLeft[matched].copy(node.content)
        searchLeft = matched - 1
      } else {
        while (searchLeft >= matched)
          result = nodesLeft[searchLeft--].copy([result])
        result.pushFrom(node)
      }
    }
    if (matched != null || node.content.length == 0) {
      if (outside) break
      if (searchRight) nodesRight[searchRight - 1].content.shift()
    }
    searchRight--
  }

  let repl = {nodes: result ? result.content : [],
              openLeft: start.depth - searchRight,
              openRight: end.depth - searchRight}
  return {repl, depth: searchLeft + 1}
}

function moveText(tr, doc, before, after) {
  let root = samePathDepth(before, after)
  let cutAt = after.shorten(null, 1)
  while (cutAt.path.length > root && doc.path(cutAt.path).content.length == 1)
    cutAt = cutAt.shorten(null, 1)
  tr.split(cutAt, cutAt.path.length - root)
  let start = after, end = new Pos(start.path, doc.path(start.path).maxOffset)
  let parent = doc.path(start.path.slice(0, root))
  let wanted = parent.pathNodes(before.path.slice(root))
  let existing = parent.pathNodes(start.path.slice(root))
  while (wanted.length && existing.length && wanted[0].sameMarkup(existing[0])) {
    wanted.shift()
    existing.shift()
  }
  if (existing.length || wanted.length)
    tr.step("ancestor", start, end, null, {
      depth: existing.length,
      wrappers: wanted.map(n => n.copy())
    })
  for (let i = root; i < before.path.length; i++)
    tr.join(before.shorten(i, 1))
}

Transform.prototype.delete = function(from, to) {
  return this.replace(from, to)
}

Transform.prototype.replace = function(from, to, source, start, end) {
  let repl, depth, doc = this.doc, maxDepth = samePathDepth(from, to)
  if (source) {
    ;({repl, depth} = buildInserted(doc.pathNodes(from.path), source, start, end))
    while (depth > maxDepth) {
      if (repl.nodes.length)
        repl = {nodes: [doc.path(from.path.slice(0, depth)).copy(repl.nodes)],
                openLeft: repl.openLeft + 1, openRight: repl.openRight + 1}
      depth--
    }
  } else {
    repl = nullRepl
    depth = maxDepth
  }
  let root = from.shorten(depth), docAfter = doc, after = to
  if (repl.nodes.length || replaceHasEffect(doc, from, to)) {
    let result = this.step("replace", from, to, root, repl)
    docAfter = result.doc
    after = result.map.map(to).pos
  }

  // If no text nodes before or after end of replacement, don't glue text
  if (!doc.path(to.path).type.block) return this
  if (!(repl.nodes.length ? source.path(end.path).type.block : doc.path(from.path).type.block)) return this

  let nodesAfter = doc.path(root.path).pathNodes(to.path.slice(depth)).slice(1)
  let nodesBefore
  if (repl.nodes.length) {
    let inserted = repl.nodes
    nodesBefore = []
    for (let i = 0; i < repl.openRight; i++) {
      let last = inserted[inserted.length - 1]
      nodesBefore.push(last)
      inserted = last.content
    }
  } else {
    nodesBefore = doc.path(root.path).pathNodes(from.path.slice(depth)).slice(1)
  }
  if (nodesAfter.length != nodesBefore.length ||
      !nodesAfter.every((n, i) => n.sameMarkup(nodesBefore[i]))) {
    let before = Pos.before(docAfter, after.shorten(null, 0))
    moveText(this, docAfter, before, after)
  }
  return this
}

Transform.prototype.insert = function(pos, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  this.step("replace", pos, pos, pos,
            {nodes: nodes, openLeft: 0, openRight: 0})
  return this
}

Transform.prototype.insertInline = function(pos, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  let styles = spanStylesAt(this.doc, pos)
  nodes = nodes.map(n => new Span(n.type, n.attrs, styles, n.text))
  return this.insert(pos, nodes)
}

Transform.prototype.insertText = function(pos, text) {
  return this.insertInline(pos, Span.text(text))
}
