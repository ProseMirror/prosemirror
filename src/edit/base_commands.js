import {browser} from "../dom"
import {joinPoint, joinable, canSplit, ReplaceAroundStep} from "../transform"
import {Slice, Fragment} from "../model"
import Keymap from "browserkeymap"

import {charCategory, isExtendingChar} from "./char"
import {findSelectionFrom, TextSelection, NodeSelection} from "./selection"

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

// :: (ProseMirror) → bool
// Join the selected block or, if there is a text selection, the
// closest ancestor block of the selection that can be joined, with
// the sibling above it.
export function joinUp(pm) {
  let point = joinPointAbove(pm)
  if (!point) return false
  let tr = pm.tr.join(point)
  tr.apply({
    selection: pm.selection.node && NodeSelection.at(tr.doc, point - tr.doc.resolve(point).nodeBefore.nodeSize)
  })
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

// :: (ProseMirror) → bool
// Lift the selected block, or the closest ancestor block of the
// selection that can be lifted, out of its parent node.
export function lift(pm) {
  let {from, to} = pm.selection
  let tr = pm.tr.lift(from, to, true).apply(pm.apply.scroll)
  return tr.steps.length > 0
}

// :: (ProseMirror) → bool
// The default binding for enter. Tries `newlineInCode`,
// `createParagraphNear`, `liftEmptyBlock`, and `splitTextblock` in
// order.
export const defaultEnter = chain(newlineInCode,
                                  createParagraphNear,
                                  liftEmptyBlock,
                                  splitBlock)

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
  pm.tr.insert(side, type.create()).apply({scrollIntoView: true,
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

// :: (ProseMirror) → bool
// Move the selection to the node wrapping the current selection, if
// any. (Will not select the document node.)
export function selectParentNode(pm) {
  let node = nodeAboveSelection(pm)
  if (node === false) return false
  pm.setNodeSelection(node)
  return true
}

// :: (ProseMirror) → bool
// Undo the most recent change event, if any.
export function undo(pm) {
  pm.scrollIntoView()
  return pm.history.undo()
}

// :: (ProseMirror) → bool
// Redo the most recently undone change event, if any.
export function redo(pm) {
  pm.scrollIntoView()
  return pm.history.redo()
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

function joinPointAbove(pm) {
  let {node, from} = pm.selection
  if (node) return joinable(pm.doc, from) ? from : null
  else return joinPoint(pm.doc, from, -1)
}

function joinPointBelow(pm) {
  let {node, to} = pm.selection
  if (node) return joinable(pm.doc, to) ? to : null
  else return joinPoint(pm.doc, to, 1)
}

function nodeAboveSelection(pm) {
  let sel = pm.selection
  if (sel.node) {
    let $from = pm.doc.resolve(sel.from)
    return !!$from.depth && $from.before()
  }
  let $head = pm.doc.resolve(sel.head)
  let same = $head.sameDepth(pm.doc.resolve(sel.anchor))
  return same == 0 ? false : $head.before(same)
}

export const baseKeymap = new Keymap({
  "Enter": defaultEnter,

  "Backspace": chain(deleteSelection, joinBackward, deleteCharBefore),
  "Mod-Backspace": chain(deleteSelection, joinBackward, deleteWordBefore),
  "Delete": chain(deleteSelection, joinForward, deleteCharAfter),
  "Mod-Delete": chain(deleteSelection, joinForward, deleteWordAfter),

  "Alt-Up": joinUp,
  "Alt-Down": joinDown,
  "Mod-[": lift,
  "Esc": selectParentNode,

  "Mod-Z": undo,
  "Mod-Y": redo,
  "Shift-Mod-Z": redo
})

if (browser.mac) baseKeymap.addBindings({
  "Ctrl-H": baseKeymap.lookup("Backspace"),
  "Alt-Backspace": baseKeymap.lookup("Mod-Backspace"),
  "Ctrl-D": baseKeymap.lookup("Delete"),
  "Ctrl-Alt-Backspace": baseKeymap.lookup("Mod-Delete"),
  "Alt-Delete": baseKeymap.lookup("Mod-Delete"),
  "Alt-D": baseKeymap.lookup("Mod-Delete")
})
