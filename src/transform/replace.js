import {Pos, Fragment, emptyFragment} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap, MovedRange, ReplacedRange} from "./map"
import {replaceHasEffect, samePathDepth} from "./tree"

// !! **`replace`**
//   : Delete the part of the document between `from` and `to` and
//     optionally replace it with another chunk of content. `pos` must
//     point at the ‘root’ at which the cut starts—a position between
//     and above `from` and `to`.
//
//     When new content is to be inserted, the step's parameter should
//     be an object of shape `{content: `[`Fragment`](#Fragment)`,
//     openLeft: number, openRight: number}`. The step will insert the
//     given content at the root of the cut, and `openLeft` and
//     `openRight` indicate how much of the content on both sides
//     should be consided ‘open’.
//
//     A replace step will try to join open nodes on both sides of the
//     cut. That is, nodes in the original document that are partially
//     cut off by `from` and `to`, and nodes at the sides of the
//     replacement content as specificed by `openLeft` and
//     `openRight`. For example, if `openLeft` is 2, the first node of
//     the replacement content as well as its first child is
//     considered open. Whenever two open nodes with the same
//     [markup](#Node.sameMarkup) end up next to each other, they are
//     joined. Open nodes that aren't joined are [closed](#Node.close)
//     to ensure their content (or lack of it) is valid.

function findMovedChunks(oldNode, oldPath, newNode, startDepth) {
  let moved = []
  let newPath = oldPath.path.slice(0, startDepth)

  for (let depth = startDepth;; depth++) {
    let joined = depth == oldPath.depth ? 0 : 1
    let cut = depth == oldPath.depth ? oldPath.offset : oldPath.path[depth]
    let afterCut = oldNode.size - cut
    let newOffset = newNode.size - afterCut

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
    let before = node.sliceBetween(null, from, depth)
    let after = node.sliceBetween(to, null, depth), result
    if (!before.type.canContainFragment(repl.content)) return null
    if (repl.content.size)
      result = before.append(repl.content, from.depth - depth, repl.openLeft)
                     .append(after.content, repl.openRight, to.depth - depth)
    else
      result = before.append(after.content, from.depth - depth, to.depth - depth)
    if (!result.size && !result.type.canBeEmpty)
      result = result.copy(result.type.defaultContent())
    return {doc: result, moved: findMovedChunks(node, to, result, depth)}
  } else {
    let pos = root[depth]
    let result = replace(node.child(pos), from, to, root, repl, depth + 1)
    if (!result) return null
    return {doc: node.replace(pos, result.doc), moved: result.moved}
  }
}

const nullRepl = {content: emptyFragment, openLeft: 0, openRight: 0}

Step.define("replace", {
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
    return new StepResult(out, new PosMap(moved, [replaced]))
  },
  invert(step, oldDoc, map) {
    let depth = step.pos.depth
    return new Step("replace", step.from, map.map(step.to).pos, step.from.shorten(depth), {
      content: oldDoc.path(step.pos.path).content.sliceBetween(step.from, step.to, depth),
      openLeft: step.from.depth - depth,
      openRight: step.to.depth - depth
    })
  },
  paramToJSON(param) {
    return param && {content: param.content.size && param.content.toJSON(),
                     openLeft: param.openLeft, openRight: param.openRight}
  },
  paramFromJSON(schema, json) {
    return json && {content: Fragment.fromJSON(schema, json.content),
                    openLeft: json.openLeft, openRight: json.openRight}
  }
})

function shiftFromStack(stack, depth) {
  let shifted = stack[depth] = stack[depth].splice(0, 1, emptyFragment)
  for (let i = depth - 1; i >= 0; i--)
    shifted = stack[i] = stack[i].replace(0, shifted)
}

// FIXME find a not so horribly confusing way to express this
function buildInserted(nodesLeft, source, start, end) {
  let sliced = source.sliceBetween(start, end)
  let nodesRight = []
  for (let node = sliced, i = 0; i <= start.path.length; i++, node = node.firstChild)
    nodesRight.push(node)
  let same = samePathDepth(start, end)
  let searchLeft = nodesLeft.length - 1, searchRight = nodesRight.length - 1
  let result = null

  let inner = nodesRight[searchRight]
  if (inner.isTextblock && inner.size && nodesLeft[searchLeft].isTextblock) {
    result = nodesLeft[searchLeft--].copy(inner.content)
    --searchRight
    shiftFromStack(nodesRight, searchRight)
  }

  for (;;) {
    let node = nodesRight[searchRight], type = node.type, matched = null
    let outside = searchRight <= same
    for (let i = searchLeft; i >= 0; i--) {
      let left = nodesLeft[i]
      if (outside ? left.type.canContainContent(node.type) : left.type == type) {
        matched = i
        break
      }
    }
    if (matched != null) {
      if (!result) {
        result = nodesLeft[matched].copy(node.content)
        searchLeft = matched - 1
      } else {
        while (searchLeft >= matched) {
          let wrap = nodesLeft[searchLeft]
          let content = Fragment.from(result)
          result = wrap.copy(searchLeft == matched ? content.append(node.content) : content)
          searchLeft--
        }
      }
    }
    if (matched != null || node.size == 0) {
      if (outside) break
      if (searchRight) shiftFromStack(nodesRight, searchRight - 1)
    }
    searchRight--
  }

  let repl = {content: result ? result.content : emptyFragment,
              openLeft: start.depth - searchRight,
              openRight: end.depth - searchRight}
  return {repl, depth: searchLeft + 1}
}

function moveText(tr, doc, before, after) {
  let root = samePathDepth(before, after)
  let cutAt = after.shorten(null, 1)
  while (cutAt.path.length > root && doc.path(cutAt.path).size == 1)
    cutAt = cutAt.shorten(null, 1)
  tr.split(cutAt, cutAt.path.length - root)
  let start = after, end = new Pos(start.path, doc.path(start.path).size)
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

// :: (Pos, Pos) → Transform
// Delete the content between the given positions.
Transform.prototype.delete = function(from, to) {
  if (from.cmp(to)) this.replace(from, to)
  return this
}

// :: (Pos, Pos, Node, Pos, Pos) → Transform
// Replace the part of the document between `from` and `to` with the
// part of the `source` between `start` and `end`.
Transform.prototype.replace = function(from, to, source, start, end) {
  let repl, depth, doc = this.doc, maxDepth = samePathDepth(from, to)
  if (source) {
    ;({repl, depth} = buildInserted(doc.pathNodes(from.path), source, start, end))
    while (depth > maxDepth) {
      if (repl.content.size)
        repl = {content: Fragment.from(doc.path(from.path.slice(0, depth)).copy(repl.content)),
                openLeft: repl.openLeft + 1, openRight: repl.openRight + 1}
      depth--
    }
  } else {
    repl = nullRepl
    depth = maxDepth
  }
  let root = from.shorten(depth), docAfter = doc, after = to
  if (repl.content.size || replaceHasEffect(doc, from, to)) {
    let result = this.step("replace", from, to, root, repl)
    docAfter = result.doc
    after = result.map.map(to).pos
  }

  // If no text nodes before or after end of replacement, don't glue text
  if (!doc.path(to.path).isTextblock) return this
  if (!(repl.content.size ? source.path(end.path).isTextblock : doc.path(from.path).isTextblock)) return this

  let nodesAfter = doc.path(root.path).pathNodes(to.path.slice(depth)).slice(1)
  let nodesBefore
  if (repl.content.size) {
    let inserted = repl.content
    nodesBefore = []
    for (let i = 0; i < repl.openRight; i++) {
      let last = inserted.child(inserted.size - 1)
      nodesBefore.push(last)
      inserted = last.content
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
      offset = node.size
    }
    moveText(this, docAfter, before, after)
  }
  return this
}

// :: (Pos, Pos, union<Fragment, Node, [Node]>) → Transform
// Replace the given range with the given content, which may be a
// fragment, node, or array of nodes.
Transform.prototype.replaceWith = function(from, to, content) {
  if (!(content instanceof Fragment)) content = Fragment.from(content)
  if (Pos.samePath(from.path, to.path))
    this.step("replace", from, to, from, {content, openLeft: 0, openRight: 0})
  else
    this.delete(from, to).step("replace", from, from, from, {content, openLeft: 0, openRight: 0})
  return this
}

// :: (Pos, union<Fragment, Node, [Node]>) → Transform
// Insert the given content at the `pos`.
Transform.prototype.insert = function(pos, content) {
  return this.replaceWith(pos, pos, content)
}

// :: (Pos, string) → Transform
// Insert the given text at `pos`, inheriting the marks of the
// existing content at that position.
Transform.prototype.insertText = function(pos, text) {
  return this.insert(pos, this.doc.type.schema.text(text, this.doc.marksAt(pos)))
}

// :: (Pos, Node) → Transform
// Insert the given node at `pos`, inheriting the marks of the
// existing content at that position.
Transform.prototype.insertInline = function(pos, node) {
  return this.insert(pos, node.mark(this.doc.marksAt(pos)))
}
