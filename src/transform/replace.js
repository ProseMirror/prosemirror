import {Fragment, Slice} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap, ReplacedRange} from "./map"

// !! **`replace`**
//   : Delete the part of the document between `from` and `to` and
//     optionally replace it with another piece of content.
//
//     When new content is to be inserted, the step's parameter should
//     be a `Slice` object that properly fits the 'gap' between `from`
//     and `to`—the depths must line up, and the surrounding nodes
//     must be able to be joined with the open sides of the slice.

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

// :: (number, number) → Transform #path=Transform.prototype.delete
// Delete the content between the given positions.
Transform.define("delete", function(from, to) {
  if (from != to) this.replace(from, to, Slice.empty)
})

// :: (number, ?number, ?Slice) → Transform #path=Transform.prototype.replace
// Replace the part of the document between `from` and `to` with the
// part of the `source` between `start` and `end`.
Transform.define("replace", function(from, to = from, slice = Slice.empty) {
  let $from = this.doc.resolve(from), $to = this.doc.resolve(to)
  let {fitted, distAfter} = fitSliceInto($from, $to, slice), fSize = fitted.size
  if (from == to && !fSize) return
  this.step("replace", from, to, fitted)

  // If the endpoints of the replacement don't end right next to each
  // other, we may need to move text that occurs directly after the
  // slice to fit onto the inserted content. But only if there is text
  // before and after the cut, and if those endpoints aren't already
  // next to each other.
  if (!fSize || !$to.node($to.depth).isTextblock) return
  let after = from + fSize
  let inner = !slice.size ? from : distAfter < 0 ? -1 : after - distAfter, $inner
  if (inner == -1 || inner == after || !($inner = this.doc.resolve(inner)).node($inner.depth).isTextblock) return
  mergeTextblockAfter(this, $inner, this.doc.resolve(after))
})

// :: (number, number, union<Fragment, Node, [Node]>) → Transform
// #path=Transform.prototype.replaceWith
// Replace the given range with the given content, which may be a
// fragment, node, or array of nodes.
Transform.define("replaceWith", function(from, to, content) {
  this.replace(from, to, new Slice(Fragment.from(content), 0, 0))
})

// :: (number, union<Fragment, Node, [Node]>) → Transform
// #path=Transform.prototype.insert
// Insert the given content at the given position.
Transform.define("insert", function(pos, content) {
  this.replaceWith(pos, pos, content)
})

// :: (number, string) → Transform #path=Transform.prototype.insertText
// Insert the given text at `pos`, inheriting the marks of the
// existing content at that position.
Transform.define("insertText", function(pos, text) {
  this.insert(pos, this.doc.type.schema.text(text, this.doc.marksAt(pos)))
})

// :: (number, Node) → Transform #path=Transform.prototype.insertInline
// Insert the given node at `pos`, inheriting the marks of the
// existing content at that position.
Transform.define("insertInline", function(pos, node) {
  this.insert(pos, node.mark(this.doc.marksAt(pos)))
})

// This is an output variable for closeFragment and friends, used to
// track the distance between the end of the resulting slice and the
// end of the inserted content, so that we can find back the position
// afterwards.
let distAfter = 0

// : (ResolvedPos, ResolvedPos, Slice) → {fitted: Slice, distAfter: number}
// Mangle the content of a slice so that it fits between the given
// positions.
function fitSliceInto($from, $to, slice) {
  let base = $from.sameDepth($to)
  let placed = placeSlice($from, slice), outer = outerPlaced(placed)
  if (outer) base = Math.min(outer.depth, base)

  // distAfter starts negative, and is set to a positive value when
  // the end of the inserted content is placed.
  distAfter = -1e10 // FIXME kludge
  let fragment = closeFragment($from.node(base).type, fillBetween($from, $to, base, placed), $from, $to, base)
  return {fitted: new Slice(fragment, $from.depth - base, $to.depth - base),
          distAfter: distAfter - ($to.depth - base)}
}

function outerPlaced(placed) {
  for (let i = 0; i < placed.length; i++) if (placed[i]) return placed[i]
}

function fillBetween($from, $to, depth, placed) {
  let fromNext = $from.depth > depth && $from.node(depth + 1)
  let toNext = $to.depth > depth && $to.node(depth + 1)
  let placedHere = placed[depth]

  if (fromNext && toNext && fromNext.type.canContainContent(toNext.type) && !placedHere)
    return Fragment.from(closeNode(fromNext, fillBetween($from, $to, depth + 1, placed),
                                   $from, $to, depth + 1))

  let content = Fragment.empty
  if (placedHere) {
    content = closeLeft(placedHere.content, placedHere.openLeft)
    if (placedHere.isEnd) distAfter = placedHere.openRight
  }

  distAfter--
  if (fromNext)
    content = content.addToStart(closeNode(fromNext, fillFrom($from, depth + 1, placed),
                                           $from, null, depth + 1))
  if (toNext)
    content = closeTo(content, $to, depth + 1, placedHere ? placedHere.openRight : 0)
  else if (placedHere)
    content = closeRight(content, placedHere.openRight)
  distAfter++

  return content
}

function fillFrom($from, depth, placed) {
  let placedHere = placed[depth], content = Fragment.empty
  if (placedHere) {
    content = closeRight(placedHere.content, placedHere.openRight)
    if (placedHere.isEnd) distAfter = placedHere.openRight
  }

  distAfter--
  if ($from.depth > depth)
    content = content.addToStart(closeNode($from.node(depth + 1), fillFrom($from, depth + 1, placed),
                                           $from, null, depth + 1))
  distAfter++

  return content
}

function closeTo(content, $to, depth, openDepth) {
  let after = $to.node(depth)
  if (openDepth == 0 || !after.type.canContainContent(content.lastChild.type)) {
    let finish = closeNode(after, fillTo($to, depth), null, $to, depth)
    distAfter += finish.nodeSize
    return closeRight(content, openDepth).addToEnd(finish)
  }
  let inner = content.lastChild.content
  if (depth < $to.depth) inner = closeTo(inner, $to, depth + 1, openDepth - 1)
  return content.replaceChild(content.childCount - 1, after.copy(inner))
}

function fillTo(to, depth) {
  if (to.depth == depth) return Fragment.empty
  return Fragment.from(closeNode(to.node(depth + 1), fillTo(to, depth + 1), null, to, depth + 1))
}

// Closing nodes is the process of ensuring that they contain valid
// content, optionally changing the content (that is inside of the
// replace) to make sure.

function closeRight(content, openDepth) {
  if (openDepth == 0) return content
  let last = content.lastChild, closed = closeNode(last, closeRight(last.content, openDepth - 1))
  return closed == last ? content : content.replaceChild(content.childCount - 1, closed)
}

function closeLeft(content, openDepth) {
  if (openDepth == 0) return content
  let first = content.firstChild, closed = closeNode(first, first.content)
  return closed == first ? content : content.replaceChild(0, closed)
}

function closeFragment(type, content, $to, $from, depth) {
  // FIXME replace this with a more general approach
  if (type.canBeEmpty) return content
  let hasContent = content.size || ($to && ($to.depth > depth || $to.index(depth))) ||
      ($from && ($from.depth > depth || $from.index(depth) < $from.node(depth).childCount))
  return hasContent ? content : type.defaultContent()
}

function closeNode(node, content, $to, $from, depth) {
  return node.copy(closeFragment(node.type, content, $to, $from, depth))
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

function fragmentSuperKind(fragment) {
  let kind
  for (let i = fragment.childCount - 1; i >= 0; i--) {
    let cur = fragment.child(i).type.kind
    kind = kind ? kind.sharedSuperKind(cur) : cur
  }
  return kind
}

function nodeLeft(slice, depth) {
  let content = slice.content
  for (let i = 1; i < depth; i++) content = content.firstChild.content
  return content.firstChild
}

function placeSlice($from, slice) {
  let dFrom = $from.depth, unplaced = null, openLeftUnplaced = 0
  let placed = [], parents = null

  for (let dSlice = slice.openLeft;; --dSlice) {
    let curType, curAttrs, curFragment
    if (dSlice >= 0) {
      if (dSlice > 0) { // Inside slice
        ;({type: curType, attrs: curAttrs, content: curFragment} = nodeLeft(slice, dSlice))
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

    let found = findPlacement(curType, curFragment, $from, dFrom)
    if (found > -1) {
      if (curFragment.size > 0)
        placed[found] = {content: curFragment,
                         openLeft: openLeftUnplaced,
                         openRight: dSlice > 0 ? 0 : slice.openRight - dSlice,
                         isEnd: dSlice <= 0,
                         depth: found}
      if (dSlice <= 0) break
      unplaced = null
      openLeftUnplaced = 0
      dFrom = Math.max(0, found - 1)
    } else {
      if (dSlice == 0) {
        parents = $from.node(0).type.findConnectionToKind(fragmentSuperKind(curFragment))
        if (!parents) break
        parents.unshift($from.node(0).type)
        curType = parents[parents.length - 1]
      }
      unplaced = curType.create(curAttrs, curFragment)
      openLeftUnplaced++
    }
  }

  return placed
}

function findPlacement(type, fragment, $from, start) {
  for (let d = start; d >= 0; d--) {
    let fromType = $from.node(d).type
    if (type ? fromType.canContainContent(type) : fromType.canContainFragment(fragment))
      return d
  }
  return -1
}

// When a replace ends in an (open) textblock, and the content that
// ends up before it also ends in an open textblock, the textblock
// after is moved to and connected with the one before it. This
// influences content outside of the replaced range, so it is not done
// as part of the replace step itself, but instead tacked on as a set
// of split/ancestor/join steps.

function mergeTextblockAfter(tr, $inside, $after) {
  let base = $inside.sameDepth($after)
  tr.try(() => {
    let end = $after.end($after.depth), cutAt = end + 1, cutDepth = $after.depth - 1
    while (cutDepth > base && $after.index(cutDepth) + 1 == $after.node(cutDepth).childCount) {
      --cutDepth
      ++cutAt
    }
    if (cutDepth > base) tr.split(cutAt, cutDepth - base)
    let types = [], attrs = []
    for (let i = base + 1; i <= $inside.depth; i++) {
      let node = $inside.node(i)
      types.push(node.type)
      attrs.push(node.attrs)
    }
    tr.step("ancestor", $after.pos, end, {depth: $after.depth - base, types, attrs})
    tr.join($after.pos - ($after.depth - base), $inside.depth - base)
  })
}
