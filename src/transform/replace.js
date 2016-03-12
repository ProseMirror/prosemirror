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

// :: (number, number) → Transform
// Delete the content between the given positions.
Transform.define("delete", function(from, to) {
  this.replace(from, to, Slice.empty)
})

// :: (number, ?number, ?Slice) → Transform
// Replace the part of the document between `from` and `to` with the
// part of the `source` between `start` and `end`.
Transform.define("replace", function(from, to = from, slice = Slice.empty) {
  slice = fitSliceInto(this.doc.resolve(from), this.doc.resolve(to), slice)
  if (from != to || slice.content.size)
    this.step("replace", from, to, slice)
})

// :: (number, number, union<Fragment, Node, [Node]>) → Transform
// Replace the given range with the given content, which may be a
// fragment, node, or array of nodes.
Transform.define("replaceWith", function(from, to, content) {
  this.replace(from, to, new Slice(Fragment.from(content), 0, 0))
})

// :: (number, union<Fragment, Node, [Node]>) → Transform
// Insert the given content at the given position.
Transform.define("insert", function(pos, content) {
  this.replaceWith(pos, pos, content)
})

// :: (number, string) → Transform
// Insert the given text at `pos`, inheriting the marks of the
// existing content at that position.
Transform.define("insertText", function(pos, text) {
  this.insert(pos, this.doc.type.schema.text(text, this.doc.marksAt(pos)))
})

// :: (number, Node) → Transform
// Insert the given node at `pos`, inheriting the marks of the
// existing content at that position.
Transform.define("insertInline", function(pos, node) {
  this.insert(pos, node.mark(this.doc.marksAt(pos)))
})

function decomposeSlice(slice) {
  let slices = [], next, openRight = slice.openRight
  for (let i = 0; i <= slice.openLeft; i++) {
    let content = (next || slice).content
    let node = next, right = openRight
    if (i < slice.openLeft - 1) {
      next = content.firstChild
      content = content.cut(next.nodeSize)
      if (content.size) {
        
      } else {
      }
    }
    slices.push(new Slice(content, 1, right))
  }
  return slices
}

function fragmentSuperKind(fragment) {
  let kind
  for (let i = fragment.childCount - 1; i >= 0; i--)
    kind = kind ? kind.sharedSuperKind(fragment.child(i).kind) : fragment.child(i).kind
  return kind
}

function openSliceLeft(slice) {
  let open = [], next
  for (let i = 0; i <= slice.openLeft; i++) {
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

function findAttachableDepths(from, slice) {
  let open = openSliceLeft(slice), openRight = slice.openRight
  let search = open.length - 1, found = []
  let found = []

  for (let depth = from.depth; depth >= search && search >= 0; --depth) {
    let cur = open[search], target = from.node[depth].type
    if (cur.node ? target.canContainContent(cur.node.type) : target.canContainFragment(cur.content)) {
      found[depth] = cur.content
      --search
    }
  }

  let openRight = slice.openRight
  // Some content couldn't be placed directly into the open side
  if (search > 0) {
    let leftover
    for (let i = search; i >= 0; i--) {
      let content = open[i].content
      leftover = leftover ? Fragment.from(open[i + 1].node.copy(leftover)).append(content) : content
    }
    console.log("left over " + leftover)
    let kind = fragmentSuperKind(leftover), landed = false
    for (let depth = matchedDepth - 1; depth >= 0; --depth) {
      let node = from.node[depth], conn = node.type.findConnectionToKind(kind)
      if (conn) {
        for (let i = conn.length - 1; i >= 0; i--)
          leftover = Fragment.from(conn[i].create(null, leftover))
        found[depth] = leftover
        openRight += conn.length
        landed = true
      }
    }
    if (!landed) openRight = 0
  }
  return {found, openRight}
}

// FIXME check and fix content restrictions
function fitSliceInto(from, to, slice) {
  let {found, openRight} = findAttachableDepths(from, slice)
  let first = 0
  while (found[first] == null && first < found.length) ++first
  let rootDepth = Math.min(first, from.sameDepth(to))

  let fitted = buildFitted(from, to, found, rootDepth, openRight)
  return new Slice(fitted, from.depth - rootDepth, to.depth - rootDepth)
}

function buildFitted(from, to, found, depth, openRight) {
  let moreFrom = from.depth > depth, moreTo = to.depth > depth
  let content = found[depth] || Fragment.empty
  if (moreFrom && moreTo && openRight > 0 && !content.size) {
    content = Fragment.from(from.node[depth].copy(buildFitted(from, to, found, depth + 1, openRight - 1)))
  } else {
    if (moreFrom) {
      let inner = buildFittedLeft(from, found, depth + 1)
      content = Fragment.from(from.node[depth].copy(inner)).append(content)
    }
    if (moreTo) {
      let inner = buildFittedRight(to, depth + 1, openRight - 1)
      content = content.append(Fragment.from(to.node[depth].copy(inner)))
    }
  }
  return content
}

function buildFittedLeft(from, found, depth) {
  let content = found[depth] || Fragment.empty
  if (from.depth > depth) {
    let inner = buildFittedLeft(from, found, depth + 1)
    content = Fragment.from(from.node[depth].copy(inner)).append(content)
  }
  return content
}

function buildFittedRight(to, depth, open) {
  !!!wrong
}

/* FIXME restore something like this
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
}*/
