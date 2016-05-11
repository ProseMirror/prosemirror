import {Fragment, Slice} from "../model"

import {ReplaceStep, ReplaceWrapStep} from "./replace_step"
import {Transform} from "./transform"

// :: (number, number) → Transform
// Delete the content between the given positions.
Transform.prototype.delete = function(from, to) {
  return this.replace(from, to, Slice.empty)
}

// :: (number, ?number, ?Slice) → Transform
// Replace the part of the document between `from` and `to` with the
// part of the `source` between `start` and `end`.
Transform.prototype.replace = function(from, to = from, slice = Slice.empty) {
  if (from == to && !slice.size) return this

  let $from = this.doc.resolve(from), $to = this.doc.resolve(to)
  let placed = placeSlice($from, slice)

  let fittedLeft = fitLeft($from, placed)
  let fitted = fitRight($from, $to, fittedLeft)
  if (fittedLeft.size == fitted.size || !canMoveText($from, $to, fittedLeft))
    return this.step(new ReplaceStep(from, to, fitted))

  let d = $to.depth, after = $to.after(d)
  while (d > 1 && after == $to.end(--d)) ++after
  fitted = fitRight($from, this.doc.resolve(after), fittedLeft)
  return this.step(new ReplaceWrapStep(from, after, to, $to.end($to.depth),
                                       fitted, fittedLeft.size))
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


function fitLeftInner($from, depth, placed) {
  let content = Fragment.empty, openRight
  if ($from.depth > depth) {
    let inner = fitLeftInner($from, depth + 1, placed)
    openRight = inner.openRight
    content = Fragment.from($from.node(depth + 1).copy(inner.content))
  } else if (placed.length == 0) {
    openRight = -1
  }

  let placedHere = placed[depth]
  if (placedHere) {
    content = content.append(placedHere.content)
    if (placedHere.isEnd) openRight = placedHere.openRight
  } else if (openRight == null) {
    content = content.append($from.node(depth).contentMatchAt($from.indexAfter(depth)).fillBefore(Fragment.empty, true))
  } else {
    openRight++
  }

  return {content, openRight}
}

function fitLeft($from, placed) {
  let {content, openRight} = fitLeftInner($from, 0, placed)
  return new Slice(content, $from.depth, openRight || 0)
}

function probeRight(parent, content, $to, depth, openRight, $from, openLeft) {
  let match, join, endIndex = content.childCount, next = null
  if (openRight > 0) {
    let last = content.lastChild
    next = probeRight(last, last.content, $to, depth + 1, openRight - 1,
                      $from, content.childCount == 1 ? openLeft - 1 : -1)
    if (next.join) endIndex--
  }

  if (openLeft >= 0)
    match = $from.node(depth).contentMatchAt($from.index(depth)).matchFragment(content, 0, endIndex)
  else
    match = parent.contentMatchAt(endIndex)

  if (depth <= $to.depth) {
    let after = $to.node(depth), afterIndex = $to.index(depth)
    if (after.childCount > afterIndex || after.type.compatibleContent(parent.type)) {
      join = match.fillBefore(after.content, true, afterIndex)
      // We can't insert content when both sides are open
      if (join && join.size && openLeft > 0 && next && next.join) join = null
    }
  }

  if (next && next.join)
    match = match.matchNode(content.lastChild)

  return {next, join, match}
}

function fitRightClosed(probe, node) {
  let content = node.content
  if (probe.next)
    content = content.replaceChild(content.childCount - 1, fitRightClosed(probe.next, content.lastChild))
  return node.copy(content.append(probe.match.fillBefore(Fragment.empty, true)))
}

function fitRightSeparate($to, depth) {
  let node = $to.node(depth)
  let fill = node.contentMatchAt(0).fillBefore(node.content, true, $to.index(depth))
  if ($to.depth > depth) fill = fill.addToEnd(fitRightSeparate($to, depth + 1))
  return node.copy(fill)
}

function fitRightJoined(probe, $to, depth, content) {
  if (probe.next) {
    let last = content.lastChild
    if (probe.next.join)
      last = last.copy(fitRightJoined(probe.next, $to, depth + 1, last.content))
    else
      last = fitRightClosed(probe.next, content.lastChild)
    if (probe.join.size)
      content = content.cutByIndex(0, content.childCount - 1).append(probe.join).addToEnd(last)
    else
      content = content.replaceChild(content.childCount - 1, last)
  } else {
    content = content.append(probe.join)
  }

  if ($to.depth > depth && (!probe.next || !probe.next.join))
    // FIXME the closing node can make the content invalid
    content = content.addToEnd(fitRightSeparate($to, depth + 1))

  return content
}

function normalizeSlice(content, openLeft, openRight) {
  while (openLeft > 0 && openRight > 0 && content.childCount == 1) {
    content = content.firstChild.content
    openLeft--
    openRight--
  }
  return new Slice(content, openLeft, openRight)
}

// : (ResolvedPos, ResolvedPos, number, Slice) → Slice
function fitRight($from, $to, slice) {
  let probe = probeRight($from.node(0), slice.content, $to, 0, slice.openRight, $from, slice.openLeft)
  // If the top level can't be joined, the step is trying to insert
  // content that can't appear in that place. Create a delete slice
  // instead.
  // FIXME we might want to be clever about selectively dropping nodes here?
  if (!probe.join) return fitRight($from, $to, fitLeft($from, []))

  let fitted = fitRightJoined(probe, $to, 0, slice.content, slice.openRight)
  return normalizeSlice(fitted, slice.openLeft, $to.depth)
}

function canMoveText($from, $to, slice) {
  if (!$to.parent.isTextblock) return false

  let match
  if (!slice.openRight) {
    let parent = $from.node($from.depth - (slice.openLeft - slice.openRight))
    if (!parent.isTextblock) return false
    match = parent.contentMatchAt(parent.childCount)
    if (slice.size)
      match = match.matchFragment(slice.content, slice.openLeft ? 1 : 0)
  } else {
    let parent = nodeRight(slice.content, slice.openRight)
    if (!parent.isTextblock) return false
    match = parent.contentMatchAt(parent.childCount)
  }
  match = match.matchFragment($to.parent.content, $to.index($to.depth))
  return match && match.validEnd()
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

function nodeLeft(content, depth) {
  for (let i = 1; i < depth; i++) content = content.firstChild.content
  return content.firstChild
}

function nodeRight(content, depth) {
  for (let i = 1; i < depth; i++) content = content.lastChild.content
  return content.lastChild
}

function placeSlice($from, slice) {
  let dFrom = $from.depth, unplaced = null
  let placed = [], parents = null

  for (let dSlice = slice.openLeft;; --dSlice) {
    let curType, curAttrs, curFragment
    if (dSlice >= 0) {
      if (dSlice > 0) { // Inside slice
        ;({type: curType, attrs: curAttrs, content: curFragment} = nodeLeft(slice.content, dSlice))
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
    if (found) {
      if (curFragment.size > 0) placed[found.depth] = {
        content: found.fill.append(curFragment),
        openRight: dSlice > 0 ? 0 : slice.openRight - dSlice,
        isEnd: dSlice <= 0,
        depth: found.depth
      }
      if (dSlice <= 0) break
      unplaced = null
      dFrom = Math.max(0, found.depth - 1)
    } else {
      if (dSlice == 0) {
        let top = $from.node(0)
        parents = top.findWrappingAt($from.index(0), curFragment.child(0).type)
        if (!parents) break
        let last = parents[parents.length - 1]
        if (last ? !last.contentExpr.matches(last.defaultAttrs, curFragment)
                 : !top.canReplace($from.indexAfter(0), $from.depth ? $from.index(0) : $from.indexAfter(0), curFragment)) break
        parents = [top.type].concat(parents)
        curType = parents[parents.length - 1]
      }
      curFragment = curType.contentExpr.start(curAttrs).fillBefore(curFragment, true).append(curFragment)
      unplaced = curType.create(curAttrs, curFragment)
    }
  }

  return placed
}

function findPlacement(fragment, $from, start) {
  for (let d = start; d >= 0; d--) {
    let match = $from.node(d).contentMatchAt($from.indexAfter(d)).fillBefore(fragment)
    if (match) return {depth: d, fill: match}
  }
}
