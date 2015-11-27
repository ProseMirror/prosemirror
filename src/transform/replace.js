import {Pos, spanStylesAt, sliceBefore, sliceAfter, sliceBetween, childrenBetween} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {PosMap, MovedRange, ReplacedRange} from "./map"
import {replaceHasEffect, samePathDepth} from "./tree"

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

    oldNode = oldNode.child(cut)
    newNode = newNode.child(newOffset)
    newPath = newPath.concat(newOffset)
  }
}

export function replace(node, from, to, root, repl, depth = 0) {
  if (depth == root.length) {
    let before = sliceBefore(node, from, depth)
    let after = sliceAfter(node, to, depth), result
    if (!repl.nodes.every(n => before.type.canContain(n))) return null
    if (repl.nodes.length)
      result = before.append(repl.nodes, from.depth - depth, repl.openLeft)
                     .append(after.children, repl.openRight, to.depth - depth)
    else
      result = before.append(after.children, from.depth - depth, to.depth - depth)
    if (!result.length && !result.type.canBeEmpty)
      result = result.copy(result.type.defaultContent())
    return {doc: result, moved: findMovedChunks(node, to, result, depth)}
  } else {
    let pos = root[depth]
    let result = replace(node.child(pos), from, to, root, repl, depth + 1)
    if (!result) return null
    return {doc: node.replace(pos, result.doc), moved: result.moved}
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
    return new Step("replace", step.from, map.map(step.to).pos, step.from.shorten(depth), {
      nodes: childrenBetween(oldDoc.path(step.pos.path), step.from, step.to, depth),
      openLeft: step.from.depth - depth,
      openRight: step.to.depth - depth
    })
  },
  paramToJSON(param) {
    return param && {nodes: param.nodes && param.nodes.map(n => n.toJSON()),
                     openLeft: param.openLeft, openRight: param.openRight}
  },
  paramFromJSON(schema, json) {
    return json && {nodes: json.nodes && json.nodes.map(schema.nodeFromJSON),
                    openLeft: json.openLeft, openRight: json.openRight}
  }
})

function shiftFromStack(stack, depth) {
  let shifted = stack[depth] = stack[depth].splice(0, 1, [])
  for (let i = depth - 1; i >= 0; i--)
    shifted = stack[i] = stack[i].replace(0, shifted)
}

// FIXME find a not so horribly confusing way to express this
function buildInserted(nodesLeft, source, start, end) {
  let sliced = sliceBetween(source, start, end, false)
  let nodesRight = []
  for (let node = sliced, i = 0; i <= start.path.length; i++, node = node.firstChild)
    nodesRight.push(node)
  let same = samePathDepth(start, end)
  let searchLeft = nodesLeft.length - 1, searchRight = nodesRight.length - 1
  let result = null

  let inner = nodesRight[searchRight]
  if (inner.isTextblock && inner.length && nodesLeft[searchLeft].isTextblock) {
    result = nodesLeft[searchLeft--].copy(inner.children)
    --searchRight
    shiftFromStack(nodesRight, searchRight)
  }

  for (;;) {
    let node = nodesRight[searchRight], type = node.type, matched = null
    let outside = searchRight <= same
    for (let i = searchLeft; i >= 0; i--) {
      let left = nodesLeft[i]
      if (outside ? left.type.canContainChildren(node) : left.type == type) {
        matched = i
        break
      }
    }
    if (matched != null) {
      if (!result) {
        result = nodesLeft[matched].copy(node.children)
        searchLeft = matched - 1
      } else {
        while (searchLeft >= matched) {
          result = nodesLeft[searchLeft].copy(searchLeft == matched ? [result].concat(node.children) : [result])
          searchLeft--
        }
      }
    }
    if (matched != null || node.length == 0) {
      if (outside) break
      if (searchRight) shiftFromStack(nodesRight, searchRight - 1)
    }
    searchRight--
  }

  let repl = {nodes: result ? result.children : [],
              openLeft: start.depth - searchRight,
              openRight: end.depth - searchRight}
  return {repl, depth: searchLeft + 1}
}

function moveText(tr, doc, before, after) {
  let root = samePathDepth(before, after)
  let cutAt = after.shorten(null, 1)
  while (cutAt.path.length > root && doc.path(cutAt.path).length == 1)
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
      types: wanted.map(n => n.type),
      attrs: wanted.map(n => n.attrs)
    })
  for (let i = root; i < before.path.length; i++)
    tr.join(before.shorten(i, 1))
}

/**
 * Delete content between two positions.
 *
 * @param  {Pos} from
 * @param  {Pos} to
 * @return this
 */
Transform.prototype.delete = function(from, to) {
  if (from.cmp(to)) this.replace(from, to)
  return this
}

/**
 * Replace the content between two positions.
 */
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
  if (!doc.path(to.path).isTextblock) return this
  if (!(repl.nodes.length ? source.path(end.path).isTextblock : doc.path(from.path).isTextblock)) return this

  let nodesAfter = doc.path(root.path).pathNodes(to.path.slice(depth)).slice(1)
  let nodesBefore
  if (repl.nodes.length) {
    let inserted = repl.nodes
    nodesBefore = []
    for (let i = 0; i < repl.openRight; i++) {
      let last = inserted[inserted.length - 1]
      nodesBefore.push(last)
      inserted = last.children
    }
  } else {
    nodesBefore = doc.path(root.path).pathNodes(from.path.slice(depth)).slice(1)
  }

  if (nodesBefore.length &&
      (nodesAfter.length != nodesBefore.length ||
       !nodesAfter.every((n, i) => n.sameMarkup(nodesBefore[i])))) {
    let {path, offset} = after.shorten(root.depth), before
    for (let node = docAfter.path(path), i = 0;; i++) {
      if (i == nodesBefore.length) {
        before = new Pos(path, offset)
        break
      }
      path.push(offset - 1)
      node = node.child(offset - 1)
      offset = node.maxOffset
    }
    moveText(this, docAfter, before, after)
  }
  return this
}

Transform.prototype.replaceWith = function(from, to, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  if (!Pos.samePath(from.path, to.path)) return this
  this.step("replace", from, to, from, {nodes: nodes, openLeft: 0, openRight: 0})
  return this
}

/**
 * Insert a node at a given position.
 *
 * @param  {Pos}   pos
 * @param  {mixed} nodes
 * @return {this}
 */
Transform.prototype.insert = function(pos, nodes) {
  return this.replaceWith(pos, pos, nodes)
}

Transform.prototype.insertInline = function(pos, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes]
  let styles = spanStylesAt(this.doc, pos)
  nodes = nodes.map(n => n.styled(styles))
  return this.insert(pos, nodes)
}

Transform.prototype.insertText = function(pos, text) {
  return this.insertInline(pos, this.doc.type.schema.text(text))
}
