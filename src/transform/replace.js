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
    return new PosMap([new ReplacedRange(step.from, step.to - step.from, step.param.size)])
  },
  invert(step, oldDoc) {
    return new Step("replace", step.from, step.from + step.param.size,
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

function fitSliceInto(from, to, slice) {
  let base = from.sameDepth(to)
  let placed = placeSlice(from, slice)
  if (placed.length) for (let i = 0;; i++) if (placed[i]) {
    base = Math.min(i, base)
    break
  }
  let fragment = closeFragment(from.node[base].type, fillBetween(from, to, base, placed), from, to, base)
  return new Slice(fragment, from.depth - base, to.depth - base)
}

function fillBetween(from, to, depth, placed) {
  let fromNext = from.depth > depth && from.node[depth + 1]
  let toNext = to.depth > depth && to.node[depth + 1]
  let placedHere = placed[depth]

  if (fromNext && toNext && fromNext.type.canContainContent(toNext.type) && !placedHere)
    return Fragment.from(closeNode(fromNext, fillBetween(from, to, depth + 1, placed),
                                   from, to, depth + 1))

  let content = placedHere ? closeLeft(placedHere.content, placedHere.openLeft) : Fragment.empty
  if (fromNext)
    content = content.addToStart(closeNode(fromNext, fillFrom(from, depth + 1, placed),
                                           from, null, depth + 1))
  if (toNext)
    content = closeTo(content, to, depth + 1, placedHere ? placedHere.openRight : 0)
  else if (placedHere)
    content = closeRight(content, placedHere.openRight)
  return content
}

function fillFrom(from, depth, placed) {
  let placedHere = placed[depth]
  let content = placedHere ? placedHere.content : Fragment.empty
  if (from.depth > depth)
    content = content.addToStart(closeNode(from.node[depth + 1], fillFrom(from, depth + 1, placed),
                                           from, null, depth + 1))
  return content
}

function closeTo(content, to, depth, openDepth) {
  let after = to.node[depth]
  if (openDepth == 0 || !after.type.canContainContent(content.lastChild.type))
    return closeRight(content, openDepth).addToEnd(closeNode(after, fillTo(to, depth), null, to, depth))
  let inner = content.lastChild.content
  if (depth < to.depth) inner = closeTo(inner, to, depth + 1, openDepth - 1)
  return content.replace(content.childCount - 1, after.copy(inner))
}

function fillTo(to, depth) {
  if (to.depth == depth) return Fragment.empty
  return Fragment.from(closeNode(to.node[depth + 1], fillTo(to, depth + 1), null, to, depth + 1))
}

// Closing nodes is the process of ensuring that they contain valid
// content, optionally changing the content (that is inside of the
// replace) to make sure.

function closeRight(content, openDepth) {
  if (openDepth == 0) return content
  let last = content.lastChild, closed = closeNode(last, closeRight(last.content, openDepth - 1))
  return closed == last ? content : content.replace(content.childCount - 1, closed)
}

function closeLeft(content, openDepth) {
  if (openDepth == 0) return content
  let first = content.firstChild, closed = closeNode(first, first.content)
  return closed == first ? content : content.replace(0, closed)
}

function closeFragment(type, content, to, from, depth) {
  // FIXME replace this with a more general approach
  if (type.canBeEmpty) return content
  let hasContent = content.size || (to && (to.depth > depth || to.index[depth])) ||
      (from && (from.depth > depth || from.index[depth] < from.node[depth].childCount))
  return hasContent ? content : type.defaultContent()
}

function closeNode(node, content, to, from, depth) {
  return node.copy(closeFragment(node.type, content, to, from, depth))
}

// Algorithm for 'placing' the elements of a slice into a gap:
//
// We consider the content of each node that is open to the left to be
// independently placeable. I.e. in <p("foo"), p("bar")>, when the
// paragraph on the left is open, "foo" can be placed (somewhere on
// the left side of the replacement gap) independently from p("bar").
//
// So placeSlice splits up a slice into a number of sub-slices,
// along with information on where they can be placed on the given
// left-side edge. It works by walking the open side of the slice,
// from the inside out, and trying to find a landing spot for each
// element, by simultaneously scanning over the gap side. When no
// place is found for an open node's content, it is left in that node.
//
// If the outer content can't be placed, a set of wrapper nodes is
// made up for it (by rooting it in the document node type using
// findConnection), and the algorithm continues to iterate over those.
// This is guaranteed to find a fit, since both stacks now start with
// the same node type (doc).

function openNodeLeft(slice, depth) {
  let content = slice.content
  for (let i = 1; i < depth; i++) content = content.firstChild.content
  return content.firstChild
}

function fragmentSuperKind(fragment) {
  let kind
  for (let i = fragment.childCount - 1; i >= 0; i--) {
    let cur = fragment.child(i).type.kind
    kind = kind ? kind.sharedSuperKind(cur) : cur
  }
  return kind
}

function placeSlice(from, slice) {
  let dFrom = from.depth, unplaced = null, openLeftUnplaced = 0
  let placed = [], parents = null

  for (let dSlice = slice.openLeft;; --dSlice) {
    let curType, curAttrs, curFragment
    if (dSlice >= 0) {
      if (dSlice > 0) { // Inside slice
        ;({type: curType, attrs: curAttrs, content: curFragment} = openNodeLeft(slice, dSlice))
      } else if (dSlice == 0) { // Top of slice
        curFragment = slice.content
      }
      if (dSlice < slice.openLeft) curFragment = curFragment.cut(curFragment.firstChild.nodeSize)
    } else { // Outside slice
      curFragment = Fragment.empty
      curType = parents[parents.length + dSlice - 1]
    }
    if (unplaced)
      curFragment = curFragment.addToStart(unplaced)

    if (curFragment.size == 0 && dSlice <= 0) break

    let found = findPlacement(curType, curFragment, from, dFrom)
    if (found > -1) {
      if (curFragment.size > 0)
        placed[found] = {content: curFragment,
                         openLeft: openLeftUnplaced,
                         openRight: dSlice > 0 ? 0 : slice.openRight - dSlice}
      if (dSlice <= 0) break
      unplaced = null
      openLeftUnplaced = 0
      dFrom = Math.max(0, found - 1)
    } else {
      if (dSlice == 0) {
        parents = from.node[0].type.findConnectionToKind(fragmentSuperKind(curFragment))
        if (!parents) break
        parents.unshift(from.node[0].type)
        curType = parents[parents.length - 1]
      }
      unplaced = curType.create(curAttrs, curFragment)
      openLeftUnplaced++
    }
  }

  return placed
}

function findPlacement(type, fragment, from, start) {
  for (let d = start; d >= 0; d--) {
    let fromType = from.node[d].type
    if (type ? fromType.canContainContent(type) : fromType.canContainFragment(fragment))
      return d
  }
  return -1
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
