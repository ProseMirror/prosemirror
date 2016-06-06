const {Fragment, Slice} = require("../model")

const {ReplaceStep, ReplaceAroundStep} = require("./replace_step")
const {Transform} = require("./transform")

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
  if (!fitted) return this
  if (fittedLeft.size != fitted.size && canMoveText($from, $to, fittedLeft)) {
    let d = $to.depth, after = $to.after(d)
    while (d > 1 && after == $to.end(--d)) ++after
    let fittedAfter = fitRight($from, this.doc.resolve(after), fittedLeft)
    if (fittedAfter)
      return this.step(new ReplaceAroundStep(from, after, to, $to.end(), fittedAfter, fittedLeft.size))
  }
  return this.step(new ReplaceStep(from, to, fitted))
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


function fitLeftInner($from, depth, placed, placedBelow) {
  let content = Fragment.empty, openRight = 0, placedHere = placed[depth]
  if ($from.depth > depth) {
    let inner = fitLeftInner($from, depth + 1, placed, placedBelow || placedHere)
    openRight = inner.openRight + 1
    content = Fragment.from($from.node(depth + 1).copy(inner.content))
  }

  if (placedHere) {
    content = content.append(placedHere.content)
    openRight = placedHere.openRight
  }
  if (placedBelow) {
    content = content.append($from.node(depth).contentMatchAt($from.indexAfter(depth)).fillBefore(Fragment.empty, true))
    openRight = 0
  }

  return {content, openRight}
}

function fitLeft($from, placed) {
  let {content, openRight} = fitLeftInner($from, 0, placed, false)
  return new Slice(content, $from.depth, openRight || 0)
}

function fitRightJoin(content, parent, $from, $to, depth, openLeft, openRight) {
  let match, count = content.childCount, matchCount = count - (openRight > 0 ? 1 : 0)
  if (openLeft < 0)
    match = parent.contentMatchAt(matchCount)
  else if (count == 1 && openRight > 0)
    match = $from.node(depth).contentMatchAt(openLeft ? $from.index(depth) : $from.indexAfter(depth))
  else
    match = $from.node(depth).contentMatchAt($from.indexAfter(depth))
      .matchFragment(content, count > 0 && openLeft ? 1 : 0, matchCount)

  let toNode = $to.node(depth)
  if (openRight > 0 && depth < $to.depth) {
    // FIXME find a less allocaty approach
    let after = toNode.content.cutByIndex($to.indexAfter(depth)).addToStart(content.lastChild)
    let joinable = match.fillBefore(after, true)
    // Can't insert content if there's a single node stretched across this gap
    if (joinable && joinable.size && openLeft > 0 && count == 1) joinable = null

    if (joinable) {
      let inner = fitRightJoin(content.lastChild.content, content.lastChild, $from, $to,
                               depth + 1, count == 1 ? openLeft - 1 : -1, openRight - 1)
      if (inner) {
        let last = content.lastChild.copy(inner)
        if (joinable.size)
          return content.cutByIndex(0, count - 1).append(joinable).addToEnd(last)
        else
          return content.replaceChild(count - 1, last)
      }
    }
  }
  if (openRight > 0)
    match = match.matchNode(count == 1 && openLeft > 0 ? $from.node(depth + 1) : content.lastChild)

  // If we're here, the next level can't be joined, so we see what
  // happens if we leave it open.
  let toIndex = $to.index(depth)
  if (toIndex == toNode.childCount && !toNode.type.compatibleContent(parent.type)) return null
  let joinable = match.fillBefore(toNode.content, true, toIndex)
  if (!joinable) return null

  if (openRight > 0) {
    let closed = fitRightClosed(content.lastChild, openRight - 1, $from, depth + 1,
                                count == 1 ? openLeft - 1 : -1)
    content = content.replaceChild(count - 1, closed)
  }
  content = content.append(joinable)
  if ($to.depth > depth)
    content = content.addToEnd(fitRightSeparate($to, depth + 1))
  return content
}

function fitRightClosed(node, openRight, $from, depth, openLeft) {
  let match, content = node.content, count = content.childCount
  if (openLeft >= 0)
    match = $from.node(depth).contentMatchAt($from.indexAfter(depth))
      .matchFragment(content, openLeft > 0 ? 1 : 0, count)
  else
    match = node.contentMatchAt(count)

  if (openRight > 0) {
    let closed = fitRightClosed(content.lastChild, openRight - 1, $from, depth + 1,
                                count == 1 ? openLeft - 1 : -1)
    content = content.replaceChild(count - 1, closed)
  }

  return node.copy(content.append(match.fillBefore(Fragment.empty, true)))
}

function fitRightSeparate($to, depth) {
  let node = $to.node(depth)
  let fill = node.contentMatchAt(0).fillBefore(node.content, true, $to.index(depth))
  if ($to.depth > depth) fill = fill.addToEnd(fitRightSeparate($to, depth + 1))
  return node.copy(fill)
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
  let fitted = fitRightJoin(slice.content, $from.node(0), $from, $to, 0, slice.openLeft, slice.openRight)
  // FIXME we might want to be clever about selectively dropping nodes here?
  if (!fitted) return null
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
  match = match.matchFragment($to.parent.content, $to.index())
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
      let parent = parents[parents.length + dSlice - 1]
      curType = parent.type
      curAttrs = parent.attrs
    }
    if (unplaced)
      curFragment = curFragment.addToStart(unplaced)

    if (curFragment.size == 0 && dSlice <= 0) break

    // FIXME cut/remove marks when it helps find a placement
    let found = findPlacement(curFragment, $from, dFrom)
    if (found) {
      if (found.fragment.size > 0) placed[found.depth] = {
        content: found.fill.append(found.fragment),
        openRight: dSlice > 0 ? 0 : slice.openRight - dSlice,
        depth: found.depth
      }
      if (dSlice <= 0) break
      unplaced = null
      dFrom = Math.max(0, found.depth - 1)
    } else {
      if (dSlice == 0) {
        let top = $from.node(0)
        parents = top.contentMatchAt($from.index(0)).findWrapping(curFragment.firstChild.type, curFragment.firstChild.attrs)
        if (!parents) break
        let last = parents[parents.length - 1]
        if (last ? !last.type.contentExpr.matches(last.attrs, curFragment)
                 : !top.canReplace($from.indexAfter(0), $from.depth ? $from.index(0) : $from.indexAfter(0), curFragment)) break
        parents = [{type: top.type, attrs: top.attrs}].concat(parents)
        curType = parents[parents.length - 1].type
        curAttrs = parents[parents.length - 1].type
      }
      curFragment = curType.contentExpr.start(curAttrs).fillBefore(curFragment, true).append(curFragment)
      unplaced = curType.create(curAttrs, curFragment)
    }
  }

  return placed
}

function findPlacement(fragment, $from, start) {
  let hasMarks = false
  for (let i = 0; i < fragment.childCount; i++)
    if (fragment.child(i).marks.length) hasMarks = true
  for (let d = start; d >= 0; d--) {
    let startMatch = $from.node(d).contentMatchAt($from.indexAfter(d))
    let match = startMatch.fillBefore(fragment)
    if (match) return {depth: d, fill: match, fragment}
    if (hasMarks) {
      let stripped = matchStrippingMarks(startMatch, fragment)
      if (stripped) return {depth: d, fill: Fragment.empty, fragment: stripped}
    }
  }
}

function matchStrippingMarks(match, fragment) {
  let newNodes = []
  for (let i = 0; i < fragment.childCount; i++) {
    let node = fragment.child(i), stripped = node.mark(node.marks.filter(m => match.allowsMark(m.type)))
    match = match.matchNode(stripped)
    if (!match) return null
    newNodes.push(stripped)
  }
  return Fragment.from(newNodes)
}
