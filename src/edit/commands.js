import {browser} from "../dom"
import {joinPoint, joinable, canLift, canSplit, canWrap, ReplaceAroundStep} from "../transform"
import {Slice, Fragment} from "../model"

import {charCategory, isExtendingChar} from "./char"
import {findSelectionFrom, TextSelection, NodeSelection} from "./selection"

// !! This module defines a number of ‘commands‘, functions that take
// a ProseMirror instance and try to perform some action on it,
// returning `false` if they don't apply. These are used to bind keys
// to, and to define [menu items](#menu).
//
// Some of the command functions defined here take a second, optional,
// boolean parameter. This can be set to `false` to do a ‘dry run’,
// where the function won't take any actual action, but will return
// information about whether it applies.

// :: (...(ProseMirror) → bool) → (ProseMirror) → bool
// Combine a number of command functions into a single function (which
// calls them one by one until one returns something other than
// `false`).
export function chain(...functions) {
  return function(pm) {
    for (let i = 0; i < functions.length; i++) {
      let val = functions[i](pm)
      if (val !== false) return val
    }
    return false
  }
}

// :: (ProseMirror) → bool
// Delete the selection, if there is one.
export function deleteSelection(pm) {
  if (pm.selection.empty) return false
  pm.tr.replaceSelection().apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror) → bool
// If the selection is empty and at the start of a textblock, move
// that block closer to the block before it, by lifting it out of its
// parent or, if it has no parent it doesn't share with the node
// before it, moving it into a parent of that node, or joining it with
// that.
export function joinBackward(pm) {
  let {head, empty} = pm.selection
  if (!empty) return false

  let $head = pm.doc.resolve(head)
  if ($head.parentOffset > 0) return false

  // Find the node before this one
  let before, cut
  for (let i = $head.depth - 1; !before && i >= 0; i--) if ($head.index(i) > 0) {
    cut = $head.before(i + 1)
    before = $head.node(i).child($head.index(i) - 1)
  }

  // If there is no node before this, try to lift
  if (!before)
    return pm.tr.lift(head, head, true).apply(pm.apply.scroll).steps.length > 0

  // If the node below has no content and the node above is
  // selectable, delete the node below and select the one above.
  if (before.type.isLeaf && before.type.selectable && $head.parent.content.size == 0) {
    let tr = pm.tr.delete(cut, cut + $head.parent.nodeSize)
    tr.apply({scrollIntoView: true,
              selection: NodeSelection.at(tr.doc, cut - before.nodeSize)})
    return true
  }

  // If the node doesn't allow children, delete it
  if (before.type.isLeaf)
    pm.tr.delete(cut - before.nodeSize, cut).apply(pm.apply.scroll)
  // Apply the joining algorithm
  else
    return deleteBarrier(pm, cut)
}

// :: (ProseMirror) → bool
// If the selection is empty and the cursor is at the end of a
// textblock, move the node after it closer to the node with the
// cursor (lifting it out of parents that aren't shared, moving it
// into parents of the cursor block, or joining the two when they are
// siblings).
export function joinForward(pm) {
  let {head, empty} = pm.selection, $head
  if (!empty || ($head = pm.doc.resolve(head)).parentOffset < $head.parent.content.size) return false

  // Find the node after this one
  let after, cut
  for (let i = $head.depth - 1; !after && i >= 0; i--) {
    let parent = $head.node(i)
    if ($head.index(i) + 1 < parent.childCount) {
      after = parent.child($head.index(i) + 1)
      cut = $head.after(i + 1)
    }
  }

  // If there is no node after this, there's nothing to do
  if (!after) return false

  // If the node doesn't allow children, delete it
  if (after.type.isLeaf)
    pm.tr.delete(cut, cut + after.nodeSize).apply(pm.apply.scroll)
  // Apply the joining algorithm
  else
    return deleteBarrier(pm, cut)
}

// :: (ProseMirror) → bool
// Delete the character before the cursor, if the selection is empty
// and the cursor isn't at the start of a textblock.
export function deleteCharBefore(pm) {
  if (browser.ios) return false
  let {head, empty} = pm.selection
  if (!empty || pm.doc.resolve(head).parentOffset == 0) return false
  let dest = moveBackward(pm.doc, head, "char")
  pm.tr.delete(dest, head).apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror) → bool
// Delete the word before the cursor, if the selection is empty and
// the cursor isn't at the start of a textblock.
export function deleteWordBefore(pm) {
  let {head, empty} = pm.selection
  if (!empty || pm.doc.resolve(head).parentOffset == 0) return false
  let dest = moveBackward(pm.doc, head, "word")
  pm.tr.delete(dest, head).apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror) → bool
// Delete the character after the cursor, if the selection is empty
// and the cursor isn't at the end of its textblock.
export function deleteCharAfter(pm) {
  let {head, empty} = pm.selection, $head
  if (!empty || ($head = pm.doc.resolve(head)).parentOffset == $head.parent.content.size) return false
  let dest = moveForward(pm.doc, head, "char")
  pm.tr.delete(head, dest).apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror) → bool
// Delete the word after the cursor, if the selection is empty and the
// cursor isn't at the end of a textblock.
export function deleteWordAfter(pm) {
  let {head, empty} = pm.selection, $head
  if (!empty || ($head = pm.doc.resolve(head)).parentOffset == $head.parent.content.size) return false
  let dest = moveForward(pm.doc, head, "word")
  pm.tr.delete(head, dest).apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror, ?bool) → bool
// Join the selected block or, if there is a text selection, the
// closest ancestor block of the selection that can be joined, with
// the sibling above it.
export function joinUp(pm, apply) {
  let {node, from} = pm.selection, point
  if (node) {
    if (node.isTextblock || !joinable(pm.doc, from)) return false
    point = from
  } else {
    point = joinPoint(pm.doc, from, -1)
    if (point == null) return false
  }
  if (apply !== false) {
    let tr = pm.tr.join(point), selection
    if (pm.selection.node) selection = NodeSelection.at(tr.doc, point - pm.doc.resolve(point).nodeBefore.nodeSize)
    tr.apply({selection})
  }
  return true
}

// :: (ProseMirror) → bool
// Join the selected block, or the closest ancestor of the selection
// that can be joined, with the sibling after it.
export function joinDown(pm) {
  let node = pm.selection.node, nodeAt = pm.selection.from
  let point = joinPointBelow(pm)
  if (!point) return false
  pm.tr.join(point).apply()
  if (node) pm.setNodeSelection(nodeAt)
  return true
}

// :: (ProseMirror, ?bool) → bool
// Lift the selected block, or the closest ancestor block of the
// selection that can be lifted, out of its parent node.
export function lift(pm, apply) {
  let {from, to} = pm.selection
  if (!canLift(pm.doc, from, to)) return false
  if (apply !== false) pm.tr.lift(from, to).apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror) → bool
// If the selection is in a node whose type has a truthy `isCode`
// property, replace the selection with a newline character.
export function newlineInCode(pm) {
  let {from, to, node} = pm.selection
  if (node) return false
  let $from = pm.doc.resolve(from)
  if (!$from.parent.type.isCode || to >= $from.end()) return false
  pm.tr.typeText("\n").apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror) → bool
// If a block node is selected, create an empty paragraph before (if
// it is its parent's first child) or after it.
export function createParagraphNear(pm) {
  let {from, to, node} = pm.selection
  if (!node || !node.isBlock) return false
  let $from = pm.doc.resolve(from), side = $from.parentOffset ? to : from
  let type = $from.parent.defaultContentType($from.indexAfter())
  if (!type.isTextblock) return false
  pm.tr.insert(side, type.createAndFill()).apply({scrollIntoView: true,
                                                  selection: new TextSelection(side + 1)})
  return true
}

// :: (ProseMirror) → bool
// If the cursor is in an empty textblock that can be lifted, lift the
// block.
export function liftEmptyBlock(pm) {
  let {head, empty} = pm.selection, $head
  if (!empty || ($head = pm.doc.resolve(head)).parent.content.size) return false
  if ($head.depth > 1 && $head.after() != $head.end(-1)) {
    let before = $head.before()
    if (canSplit(pm.doc, before)) return pm.tr.split(before).apply(pm.apply.scroll)
  }
  let tr = pm.tr.lift(head, head, true).apply(pm.apply.scroll)
  return tr.steps.length > 0
}

// :: (ProseMirror) → bool
// Split the parent block of the selection. If the selection is a text
// selection, delete it.
export function splitBlock(pm) {
  let {from, to, node} = pm.selection, $from = pm.doc.resolve(from)
  if (node && node.isBlock) {
    if (!$from.parentOffset || !canSplit(pm.doc, from)) return false
    pm.tr.split(from).apply(pm.apply.scroll)
    return true
  } else {
    let $to = pm.doc.resolve(to), atEnd = $to.parentOffset == $to.parent.content.size
    let tr = pm.tr.delete(from, to)
    let deflt = $from.node(-1).defaultContentType($from.indexAfter(-1)), type = atEnd ? deflt : null
    if (canSplit(tr.doc, from, 1, type)) {
      tr.split(from, 1, type)
      if (!atEnd && !$from.parentOffset && $from.parent.type != deflt)
        tr.setNodeType($from.before(), deflt)
    }
    tr.apply(pm.apply.scroll)
    return tr.steps.length > 0
  }
}

// :: (ProseMirror, ?bool) → bool
// Move the selection to the node wrapping the current selection, if
// any. (Will not select the document node.)
export function selectParentNode(pm, apply) {
  let sel = pm.selection, pos
  if (sel.node) {
    let $from = pm.doc.resolve(sel.from)
    if (!$from.depth) return false
    pos = $from.before()
  } else {
    let $head = pm.doc.resolve(sel.head)
    let same = $head.sameDepth(pm.doc.resolve(sel.anchor))
    if (same == 0) return false
    pos = $head.before(same)
  }
  if (apply !== false) pm.setNodeSelection(pos)
  return true
}

// :: (ProseMirror, ?bool) → bool
// Undo the most recent change event, if any.
export function undo(pm, apply) {
  if (pm.history.undoDepth == 0) return false
  if (apply !== false) {
    pm.scrollIntoView()
    pm.history.undo()
  }
  return true
}

// :: (ProseMirror, ?bool) → bool
// Redo the most recently undone change event, if any.
export function redo(pm, apply) {
  if (pm.history.redoDepth == 0) return false
  if (apply !== false) {
    pm.scrollIntoView()
    pm.history.redo()
  }
  return true
}

function deleteBarrier(pm, cut) {
  let $cut = pm.doc.resolve(cut), before = $cut.nodeBefore, after = $cut.nodeAfter, conn
  if (joinable(pm.doc, cut)) {
    let tr = pm.tr.join(cut)
    if (tr.steps.length && before.content.size == 0 && !before.sameMarkup(after) &&
        $cut.parent.canReplace($cut.index() - 1, $cut.index()))
      tr.setNodeType(cut - before.nodeSize, after.type, after.attrs)
    tr.apply(pm.apply.scroll)
    return true
  } else if (after.isTextblock && (conn = before.contentMatchAt($cut.index()).findWrapping(after.type, after.attrs))) {
    let end = cut + after.nodeSize, wrap = Fragment.empty
    for (let i = conn.length - 1; i >= 0; i--)
      wrap = Fragment.from(conn[i].type.create(conn[i].attrs, wrap))
    wrap = Fragment.from(before.copy(wrap))
    pm.tr.step(new ReplaceAroundStep(cut - 1, end, cut, end, new Slice(wrap, 1, 0), conn.length, true))
      .join(end + 2 * conn.length, 1, true)
      .apply(pm.apply.scroll)
    return true
  } else {
    let selAfter = findSelectionFrom(pm.doc, cut, 1)
    let tr = pm.tr.lift(selAfter.from, selAfter.to, true).apply(pm.apply.scroll)
    return tr.steps.length > 0
  }
}

// Get an offset moving backward from a current offset inside a node.
function moveBackward(doc, pos, by) {
  if (by != "char" && by != "word")
    throw new RangeError("Unknown motion unit: " + by)

  let $pos = doc.resolve(pos)
  let parent = $pos.parent, offset = $pos.parentOffset

  let cat = null, counted = 0
  for (;;) {
    if (offset == 0) return pos
    let {offset: start, node} = parent.childBefore(offset)
    if (!node) return pos
    if (!node.isText) return cat ? pos : pos - 1

    if (by == "char") {
      for (let i = offset - start; i > 0; i--) {
        if (!isExtendingChar(node.text.charAt(i - 1)))
          return pos - 1
        offset--
        pos--
      }
    } else if (by == "word") {
      // Work from the current position backwards through text of a singular
      // character category (e.g. "cat" of "#!*") until reaching a character in a
      // different category (i.e. the end of the word).
      for (let i = offset - start; i > 0; i--) {
        let nextCharCat = charCategory(node.text.charAt(i - 1))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return pos
        offset--
        pos--
        counted++
      }
    }
  }
}

function moveForward(doc, pos, by) {
  if (by != "char" && by != "word")
    throw new RangeError("Unknown motion unit: " + by)

  let $pos = doc.resolve(pos)
  let parent = $pos.parent, offset = $pos.parentOffset

  let cat = null, counted = 0
  for (;;) {
    if (offset == parent.content.size) return pos
    let {offset: start, node} = parent.childAfter(offset)
    if (!node) return pos
    if (!node.isText) return cat ? pos : pos + 1

    if (by == "char") {
      for (let i = offset - start; i < node.text.length; i++) {
        if (!isExtendingChar(node.text.charAt(i + 1)))
          return pos + 1
        offset++
        pos++
      }
    } else if (by == "word") {
      for (let i = offset - start; i < node.text.length; i++) {
        let nextCharCat = charCategory(node.text.charAt(i))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return pos
        offset++
        pos++
        counted++
      }
    }
  }
}

function joinPointBelow(pm) {
  let {node, to} = pm.selection
  if (node) return joinable(pm.doc, to) ? to : null
  else return joinPoint(pm.doc, to, 1)
}

// :: (ProseMirror, NodeType, ?Object, ?bool) → bool
// Wrap the selection in a node of the given type with the given
// attributes. When `apply` is `false`, just tell whether this is
// possible, without performing any action.
export function wrapIn(pm, nodeType, attrs, apply) {
  let {from, to} = pm.selection
  // FIXME duplicate work
  if (!canWrap(pm.doc, from, to, nodeType, attrs)) return false
  if (apply !== false) pm.tr.wrap(from, to, nodeType, attrs).apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror, NodeType, ?Object, ?bool) → bool
// Try to the textblock around the selection to the given node type
// with the given attributes. Return `true` when this is possible. If
// `apply` is `false`, just report whether the change is possible,
// don't perform any action.
export function setBlockType(pm, nodeType, attrs, apply) {
  let {from, to, node} = pm.selection, $from = pm.doc.resolve(from), depth
  if (node) {
    depth = $from.depth
  } else {
    if (to > $from.end()) return false
    depth = $from.depth - 1
  }
  if ((node || $from.parent).hasMarkup(nodeType, attrs)) return false
  let index = $from.index(depth)
  if (!$from.node(depth).canReplaceWith(index, index + 1, nodeType)) return false
  if (apply !== false) {
    let where = $from.before(depth + 1)
    pm.tr.clearMarkupFor(where, nodeType, attrs)
      .setNodeType(where, nodeType, attrs)
      .apply(pm.apply.scroll)
  }
  return true
}

// List-related commands

// :: (ProseMirror, NodeType, ?Object, ?bool) → bool
// Wrap the selection in a list with the given type an attributes. If
// `apply` is `false`, only return a value to indicate whether this is
// possible, but don't actually perform the change.
export function wrapInList(pm, nodeType, attrs, apply) {
  let {from, to} = pm.selection
  let $from = pm.doc.resolve(from), depth = $from.blockRangeDepth(to), doJoin = false
  // This is at the top of an existing list item
  if (depth >= 2 && $from.node(depth - 1).type.compatibleContent(nodeType) && $from.index(depth) == 0) {
    // Don't do anything if this is the top of the list
    if ($from.index(depth - 1) == 0) return false
    doJoin = true
  }
  if (apply !== false) {
    let tr = pm.tr, start = from, end = to
    if (doJoin) {
      tr.join($from.before(depth))
      start -= 2
      end -= 2
    }
    tr.wrap(start, end, nodeType, attrs).apply(pm.apply.scroll)
  }
  return true
}

// :: (ProseMirror, NodeType) → bool
// Split a non-empty textblock at the top level of a list item by also
// splitting that list item.
export function splitListItem(pm, nodeType) {
  let {from, to, node} = pm.selection, $from = pm.doc.resolve(from)
  if ((node && node.isBlock) || !$from.parent.content.size ||
      $from.depth < 2 || !$from.sameParent(pm.doc.resolve(to))) return false
  let grandParent = $from.node(-1)
  if (grandParent.type != nodeType) return false
  let nextType = to == $from.end() ? grandParent.defaultContentType($from.indexAfter(-1)) : null
  let tr = pm.tr.delete(from, to)
  if (!canSplit(tr.doc, from, 2, nextType)) return false
  tr.split(from, 2, nextType).apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror, NodeType) → bool
// Lift the list item around the selection up into a wrapping list.
export function liftListItem(pm, nodeType) {
  let {from, to} = pm.selection, $from = pm.doc.resolve(from)
  let depth = $from.blockRangeDepth(to, node => node.childCount && node.firstChild.type == nodeType)
  if (depth == null || depth < 2 || $from.node(depth - 1).type != nodeType) return false
  let $to = pm.doc.resolve(to)
  let tr = pm.tr, end = $to.after(depth + 1), endOfList = $to.end(depth)
  if (end < endOfList) {
    // There are siblings after the lifted items, which must become
    // children of the last item
    tr.step(new ReplaceAroundStep(end - 1, endOfList, end, endOfList,
                                  new Slice(Fragment.from(nodeType.create(null, $to.node(depth).copy())), 1, 0), 1, true))
    end = endOfList
  }
  tr.lift($from.before(depth + 1), end).apply(pm.apply.scroll)
  return true
}

// :: (ProseMirror, NodeType) → bool
// Sink the list item around the selection down into an inner list.
export function sinkListItem(pm, nodeType) {
  let {from, to} = pm.selection, $from = pm.doc.resolve(from)
  let depth = $from.blockRangeDepth(to, node => node.childCount && node.firstChild.type == nodeType)
  if (depth == null) return false
  let startIndex = $from.index(depth)
  if (startIndex == 0) return false
  let parent = $from.node(depth), nodeBefore = parent.child(startIndex - 1)
  if (nodeBefore.type != nodeType) return false
  let nestedBefore = nodeBefore.lastChild && nodeBefore.lastChild.type == parent.type
  let inner = Fragment.from(nestedBefore ? nodeType.create() : null)
  let slice = new Slice(Fragment.from(nodeType.create(null, Fragment.from(parent.copy(inner)))),
                        nestedBefore ? 3 : 1, 0)
  let before = $from.before(depth + 1), after = pm.doc.resolve(to).after(depth + 1)
  pm.tr.step(new ReplaceAroundStep(before - (nestedBefore ? 3 : 1), after,
                                   before, after, slice, 1, true))
    .apply(pm.apply.scroll)
  return true
}
