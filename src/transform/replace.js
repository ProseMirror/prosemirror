import {Fragment, Slice} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {ShiftStep} from "./shift"
import {PosMap} from "./map"

// ;; Replace a part of the document with a slice of new content.
class ReplaceStep extends Step {
  // :: (number, number, Slice)
  // The given `slice` should fit the 'gap' between `from` and
  // `to`—the depths must line up, and the surrounding nodes must be
  // able to be joined with the open sides of the slice.
  constructor(from, to, slice) {
    super()
    this.from = from
    this.to = to
    this.slice = slice
  }

  apply(doc) {
    return StepResult.fromReplace(doc, this.from, this.to, this.slice)
  }

  posMap() {
    return new PosMap([this.from, this.to - this.from, this.slice.size])
  }

  invert(doc) {
    return new ReplaceStep(this.from, this.from + this.slice.size, doc.slice(this.from, this.to))
  }

  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1)
    if (from.deleted && to.deleted) return null
    return new ReplaceStep(from.pos, Math.max(from.pos, to.pos), this.slice)
  }

  static fromJSON(schema, json) {
    return new ReplaceStep(json.from, json.to, Slice.fromJSON(schema, json.slice))
  }
}

Step.register("replace", ReplaceStep)

// ;; Replace a part of the document with a slice of content, but
// preserve a range of the replaced content by moving it into the
// slice.
class ReplaceWrapStep extends Step {
  // :: (number, number, number, number, Slice, number)
  constructor(from, to, gapFrom, gapTo, slice, insert) {
    super()
    this.from = from
    this.to = to
    this.gapFrom = gapFrom
    this.gapTo = gapTo
    this.slice = slice
    this.insert = insert
  }

  apply(doc) {
    let gap = doc.slice(this.gapFrom, this.gapTo)
    if (gap.openLeft || gap.openRight)
      return StepResult.fail("Gap is not a flat range")
    return StepResult.fromReplace(doc, this.from, this.to, this.slice.insertAt(this.insert, gap.content))
  }

  posMap() {
    return new PosMap([this.from, this.gapFrom - this.from, this.insert,
                       this.gapTo, this.to - this.gapTo, this.slice.size - this.insert])
  }

  invert(doc) {
    return new ReplaceWrapStep(this.from, this.from + this.slice.size,
                               this.from + this.insert, this.to - (this.slice.size - this.insert),
                               doc.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from),
                               this.gapFrom - this.from)
  }

  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1)
    let gapFrom = mapping.map(this.gapFrom, -1), gapTo = mapping.map(this.gapTo, 1)
    if ((from.deleted && to.deleted) || gapFrom < from.pos || gapTo > to.pos) return null
    return new ReplaceWrapStep(from.pos, to.pos, gapFrom, gapTo, this.slice, this.insert)
  }

  static fromJSON(schema, json) {
    return new ReplaceWrapStep(json.from, json.to, json.gapFrom, json.gapTo,
                               Slice.fromJSON(schema, json.slice), json.insert)
  }
}

Step.register("replaceWrap", ReplaceWrapStep)

// :: (number, number) → Transform
// Delete the content between the given positions.
Transform.prototype.delete = function(from, to) {
  if (from != to) this.replace(from, to, Slice.empty)
  return this
}

// :: (number, ?number, ?Slice) → Transform
// Replace the part of the document between `from` and `to` with the
// part of the `source` between `start` and `end`.
Transform.prototype.replace = function(from, to = from, slice = Slice.empty) {
  let $from = this.doc.resolve(from), $to = this.doc.resolve(to)
  let {fitted, distAfter} = fitSliceInto($from, $to, slice), fSize = fitted.size
  if (from == to && !fSize) return this
  this.step(new ReplaceStep(from, to, fitted))

  // If the endpoints of the replacement don't end right next to each
  // other, we may need to move text that occurs directly after the
  // slice to fit onto the inserted content. But only if there is text
  // before and after the cut, and if those endpoints aren't already
  // next to each other.
  if (!fSize || !$to.parent.isTextblock) return this
  let after = from + fSize
  let inner = !slice.size ? from : distAfter < 0 ? -1 : after - distAfter, $inner
  if (inner == -1 || inner == after ||
      !($inner = this.doc.resolve(inner)).parent.isTextblock ||
      !$inner.parent.canAppendFragment($to.parent.content))
    return this
  mergeTextblockAfter(this, $inner, this.doc.resolve(after))
  return this
}

// :: (number, number, union<Fragment, Node, [Node]>) → Transform
// Replace the given range with the given content, which may be a
// fragment, node, or array of nodes.
Transform.prototype.replaceWith = function(from, to, content) {
  return this.replace(from, to, new Slice(Fragment.from(content), 0, 0))
}

// :: (number, union<Fragment, Node, [Node]>) → Transform
// Insert the given content at the given position.
Transform.prototype.insert = function(pos, content) {
  return this.replaceWith(pos, pos, content)
}

// :: (number, string) → Transform
// Insert the given text at `pos`, inheriting the marks of the
// existing content at that position.
Transform.prototype.insertText = function(pos, text) {
  return this.insert(pos, this.doc.type.schema.text(text, this.doc.marksAt(pos)))
}

// :: (number, Node) → Transform
// Insert the given node at `pos`, inheriting the marks of the
// existing content at that position.
Transform.prototype.insertInline = function(pos, node) {
  return this.insert(pos, node.mark(this.doc.marksAt(pos)))
}

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
  let fragment = closeFragment($from.node(base), fillBetween($from, $to, base, placed), $from, $to, base)
  return {fitted: new Slice(fragment, $from.depth - base, $to.depth - base),
          distAfter: distAfter - ($to.depth - base)}
}

function outerPlaced(placed) {
  for (let i = 0; i < placed.length; i++) if (placed[i]) return placed[i]
}

// Given a replaced range and a set of placements, produce a fragment
// that represents the fitted content. Recursive, called once for each
// depth where both sides are open, until the first placement.
function fillBetween($from, $to, depth, placed) {
  let fromNext = $from.depth > depth && $from.node(depth + 1)
  let toNext = $to.depth > depth && $to.node(depth + 1)
  let placedHere = placed[depth]

  // If there's depth left on both sides, the two are compatible, and
  // nothing is placed here, make a recursive call.
  if (fromNext && toNext && toNext.type.compatibleContent(fromNext.type) && !placedHere)
    return Fragment.from(closeNode(fromNext, fillBetween($from, $to, depth + 1, placed),
                                   $from, $to, depth + 1))

  // Otherwise, build up the content by combining the open pieces to
  // the left and right with the inserted content placed here.

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
  if (openDepth == 0 || !content.lastChild.type.compatibleContent(after.type)) {
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

function closeFragment(refNode, content, $to, $from, depth) {
  let before = !$to ? Fragment.empty
      : $to.depth == depth ? $to.parent.content.cut(0, $to.parentOffset)
      : $to.node(depth).content.cutByIndex(0, $to.index(depth))
  let after = !$from ? Fragment.empty
      : $from.depth == depth ? $from.parent.content.cut($from.parentOffset)
      : $from.node(depth).content.cutByIndex($from.index(depth) + 1)
  let expr = refNode.type.contentExpr
  content = expr.getMatchAt(refNode.attrs, before).fillBefore(content).append(content)
  return content.append(expr.getMatchAt(refNode.attrs, before.append(content)).fillBefore(after, true))
  // FIXME verify
}

function closeNode(node, content, $to, $from, depth) {
  return node.copy(closeFragment(node, content, $to, $from, depth))
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
// findWrapping), and the algorithm continues to iterate over those.
// This is guaranteed to find a fit, since both stacks now start with
// the same node type (doc).

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

    let found = findPlacement(curFragment, $from, dFrom)
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
        // FIXME this is dodgy -- might not find a fit, even if one
        // exists, because it searches based only on the first child.
        parents = $from.node(0).findWrappingAt($from.index(0), curFragment.child(0).type)
        if (!parents || !parents[parents.length - 1].contentExpr.matches(parents[parents.length - 1].defaultAttrs, curFragment)) break
        parents = [$from.node(0).type].concat(parents)
        curType = parents[parents.length - 1]
      }
      unplaced = curType.create(curAttrs, curFragment)
      openLeftUnplaced++
    }
  }

  return placed
}

function findPlacement(fragment, $from, start) {
  for (let d = start; d >= 0; d--) if ($from.node(d).canAppendFragment(fragment)) return d
  return -1
}

// When a replace ends in an (open) textblock, and the content that
// ends up before it also ends in an open textblock, the textblock
// after is moved to and connected with the one before it. This
// influences content outside of the replaced range, so it is not done
// as part of the replace step itself, but instead tacked on as a
// shift step.

function mergeTextblockAfter(tr, $inside, $after) {
  let base = $inside.sameDepth($after), dInside = $inside.depth - base, dAfter = $after.depth - base
  let delDepth = $after.depth - 1
  while (delDepth > base && $after.index(delDepth) + 1 == $after.node(delDepth).childCount)
    --delDepth

  tr.step(new ShiftStep($after.pos, $after.pos + $after.parent.content.size,
                        {overwrite: dInside + dAfter, close: 0, open: []},
                        {overwrite: $after.depth - delDepth, close: dInside, open: delDepth - base}))
}
