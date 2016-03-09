import {Fragment, Slice} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap, ReplacedRange} from "./map"

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

Step.define("replace", {
  apply(doc, step) {
    return StepResult.fromReplace(doc, step.from, step.to, step.param)
  },
  posMap(step) {
    return new PosMap([new ReplacedRange(step.from, step.to - step.from, step.param.content.size)])
  },
  invert(step, oldDoc) {
    return new Step("replace", step.from, step.from + step.param.content.size,
                    oldDoc.slice(step.from, step.to))
  },
  paramToJSON(param) { return param.toJSON() },
  paramFromJSON(schema, json) { return Slice.fromJSON(schema, json) }
})

// :: (number, ?number, ?Slice) → Transform
// Replace the part of the document between `from` and `to` with the
// part of the `source` between `start` and `end`.
Transform.define("replace", function(from, to = from, slice = Slice.empty) {
  slice = fitSliceInto(this.doc.resolve(from), this.doc.resolve(to), slice)
  if (from != to || slice.content.size)
    this.step("replace", from, to, slice)
})

// FIXME check and fix content restrictions
function fitSliceInto(from, to, slice) {
  let open = openSliceLeft(slice)
  // The part (a Node) of the slice that has been 'fitted' onto
  // `from`, along with the depth at which it fits.
  let landed, searchDepth = from.depth
  // The part (Fragment) of the slice that could not yet be fitted.
  // Kept in sync with the iteration over the open nodes, so that this
  // (if non-null) is always of the content type that open[i + 1]
  // contained.
  let unlanded

  // Iterate over the left open side of `slice`, trying to 'land' each
  // level on an open element in `from`.
  for (let i = open.length - 1; i >= 0; i--) {
    let {content, node} = open[i], matched = -1
    for (let j = searchDepth; matched < 0 && j >= i; j--) {
      let other = from.node[j].type
      if (node ? other.canContainFragment(content) : other.canContainContent(node.type))
        matched = j
    }

    // Any unlanded content fits in here, so try to land it along
    // with this content
    if (unlanded) {
      unlanded = content = Fragment.from(open[i + 1].node.copy(unlanded)).append(content)
      unlanded = null
    }

    if (matched != -1) { // Found a place to put this content
      let parent = from.node[matched]
      // Combine with existing landed content, if any
      if (landed) {
        for (let j = searchDepth; j >= matched + 1; j--)
          landed = from.node[j].copy(landed)
        content = Fragment.from(landed).append(content)
      }
      landed = parent.copy(content)
      searchDepth = matched - 1
    } else { // No matching open node found
      if (content.size) unlanded = content
    }
  }

  // If there is unlanded content left, try to find a place for it
  // using `findConnection`
  if (unlanded) {
    let kind // The most general kind of the unlanded content
    for (let i = unlanded.childCount - 1; i >= 0; i--)
      kind = kind ? kind.sharedSuperKind(unlanded.child(i).kind) : unlanded.child(i).kind
    for (let i = searchDepth; i >= 0; i--) {
      let parent = from.node[i], path = parent.type.findConnectionToKind(kind)
      if (!path) continue
      for (let j = path.length - 1; j >= 0; j--)
        unlanded = Fragment.from(path[j].create(null, unlanded))
      if (landed) {
        for (let j = searchDepth; j >= matched + 1; j--)
          landed = from.node[j].copy(landed)
        unlanded = Fragment.from(landed).append(unlanded)
      }
      landed = parent.copy(unlanded)
      searchDepth = i - 1
      break
    }
  }

  // FIXME determine openRight, add empty nodes to match additional open nodes in to
  return new Slice(landed.content, from.depth - searchDepth, FIXME)
}

function openSliceLeft(slice) {
  let open = [], next
  for (let i = 0; i < slice.openLeft; i++) {
    let content = (next || slice).content
    let node = next
    if (i < slice.openLeft - 1) {
      next = content.firstChild
      content = content.cut(next.nodeSize)
    }
    open.push({content, node})
  }
  return open
} 

function shiftFromStack(stack, depth) {
  let shifted = stack[depth] = stack[depth].slice(1)
  for (let i = depth - 1; i >= 0; i--)
    shifted = stack[i] = stack[i].replace(0, shifted)
}

// : ([Node], Node, Pos, Pos) → {repl: {content: Fragment, openLeft: number, openRight: number}, depth: number}
// Given a document that should be inserted into another document,
// create a modified document that can be inserted into the other
// based on schema context.
// FIXME find a not so horribly confusing way to express this
function buildInserted(nodesLeft, source, start, end) {
  let sliced = source.sliceBetween(start, end)
  let nodesRight = []
  for (let node = sliced, i = 0; i <= start.path.length; i++, node = node.firstChild)
    nodesRight.push(node)
  let same = samePathDepth(start, end)
  let searchLeft = nodesLeft.length - 1, searchRight = nodesRight.length - 1
  let result = null, dLeft = start.depth, dRight = end.depth

  let inner = nodesRight[searchRight]
  if (inner.isTextblock && inner.size && nodesLeft[searchLeft].isTextblock) {
    result = nodesLeft[searchLeft--].copy(inner.content)
    --searchRight
    shiftFromStack(nodesRight, searchRight)
  }

  for (;; searchRight--) {
    let node = nodesRight[searchRight], type = node.type, matched = null
    let outside = searchRight <= same
    // Find the first node (searching from leaf to trunk) which can
    // contain the content to be inserted.
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
      if (outside) break
    } else {
      --dLeft
    }
    if (matched != null || node.size == 0) {
      if (outside && matched == null) --dRight
      shiftFromStack(nodesRight, searchRight - 1)
    }
  }

  let repl = {content: result ? result.content : Fragment.empty,
              openLeft: dLeft - searchRight,
              openRight: dRight - searchRight}
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
    tr.step("ancestor", start, end, {
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
    let result = this.step("replace", from, to, repl)
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
    this.step("replace", from, to, {content, openLeft: 0, openRight: 0})
  else
    this.delete(from, to).step("replace", from, from, {content, openLeft: 0, openRight: 0})
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
