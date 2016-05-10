import {Fragment, Slice} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap} from "./map"

// ;; Replace a part of the document with a slice of new content.
export class ReplaceStep extends Step {
  // :: (number, number, Slice)
  // The given `slice` should fit the 'gap' between `from` and
  // `to`—the depths must line up, and the surrounding nodes must be
  // able to be joined with the open sides of the slice.
  constructor(from, to, slice, structure) {
    super()
    this.from = from
    this.to = to
    this.slice = slice
    this.structure = !!structure
  }

  apply(doc) {
    if (this.structure && contentBetween(doc, this.from, this.to))
      return StepResult.fail("Structure replace would overwrite content")
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
export class ReplaceWrapStep extends Step {
  // :: (number, number, number, number, Slice, number)
  constructor(from, to, gapFrom, gapTo, slice, insert, structure) {
    super()
    this.from = from
    this.to = to
    this.gapFrom = gapFrom
    this.gapTo = gapTo
    this.slice = slice
    this.insert = insert
    this.structure = !!structure
  }

  apply(doc) {
    if (this.structure && (contentBetween(doc, this.from, this.gapFrom) ||
                           contentBetween(doc, this.gapTo, this.to)))
      return StepResult.fail("Structure gap-replace would overwrite content")

    let gap = doc.slice(this.gapFrom, this.gapTo)
    if (gap.openLeft || gap.openRight)
      return StepResult.fail("Gap is not a flat range")
    let inserted = this.slice.insertAt(this.insert, gap.content)
    if (!inserted) return StepResult.fail("Content does not fit in gap")
    return StepResult.fromReplace(doc, this.from, this.to, inserted)
  }

  posMap() {
    return new PosMap([this.from, this.gapFrom - this.from, this.insert,
                       this.gapTo, this.to - this.gapTo, this.slice.size - this.insert])
  }

  invert(doc) {
    let gap = this.gapTo - this.gapFrom
    return new ReplaceWrapStep(this.from, this.from + this.slice.size + gap,
                               this.from + this.insert, this.from + this.insert + gap,
                               doc.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from),
                               this.gapFrom - this.from, this.structure)
  }

  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1)
    let gapFrom = mapping.map(this.gapFrom, -1), gapTo = mapping.map(this.gapTo, 1)
    if ((from.deleted && to.deleted) || gapFrom < from.pos || gapTo > to.pos) return null
    return new ReplaceWrapStep(from.pos, to.pos, gapFrom, gapTo, this.slice, this.insert, this.structure)
  }

  static fromJSON(schema, json) {
    return new ReplaceWrapStep(json.from, json.to, json.gapFrom, json.gapTo,
                               Slice.fromJSON(schema, json.slice), json.insert, json.structure)
  }
}

function contentBetween(doc, from, to) {
  let $from = doc.resolve(from), dist = to - from, depth = $from.depth
  while (dist > 0 && depth > 0 && $from.indexAfter(depth) == $from.node(depth).childCount) {
    depth--
    dist--
  }
  if (dist > 0) {
    let next = $from.node(depth).maybeChild($from.indexAfter(depth))
    while (dist > 0) {
      if (!next || next.type.isLeaf) return true
      next = next.firstChild
      dist--
    }
  }
  return false
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

  if (!probe.join) throw new Error("Sorry I didn't deal with this yet")
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
        // FIXME this is dodgy -- might not find a fit, even if one
        // exists, because it searches based only on the first child.
        parents = $from.node(0).findWrappingAt($from.index(0), curFragment.child(0).type)
        if (!parents || !parents[parents.length - 1].contentExpr.matches(parents[parents.length - 1].defaultAttrs, curFragment)) break
        parents = [$from.node(0).type].concat(parents)
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
