import {joinPoint, joinable, canLift} from "../transform"
import {AssertionError} from "../util/error"

import {charCategory, isExtendingChar} from "./char"
import {findSelectionFrom} from "./selection"

// :: Object<CommandSpec>
// The set of default commands defined by the core library. They are
// included in the [default command set](#CommandSet.default).
export const baseCommands = Object.create(null)

// ;; #kind=command
// Delete the selection, if there is one.
//
// **Keybindings:** Backspace, Delete, Mod-Backspace, Mod-Delete,
// **Ctrl-H (Mac), Alt-Backspace (Mac), Ctrl-D (Mac),
// **Ctrl-Alt-Backspace (Mac), Alt-Delete (Mac), Alt-D (Mac)
baseCommands.deleteSelection = {
  label: "Delete the selection",
  run(pm) {
    return pm.tr.replaceSelection().apply(pm.apply.scroll)
  },
  keys: {
    all: ["Backspace(10)", "Delete(10)", "Mod-Backspace(10)", "Mod-Delete(10)"],
    mac: ["Ctrl-H(10)", "Alt-Backspace(10)", "Ctrl-D(10)", "Ctrl-Alt-Backspace(10)", "Alt-Delete(10)", "Alt-D(10)"]
  }
}

function deleteBarrier(pm, cut) {
  let $cut = pm.doc.resolve(cut), before = $cut.nodeBefore, after = $cut.nodeAfter
  if (before.type.canContainContent(after.type)) {
    let tr = pm.tr.join(cut)
    if (tr.steps.length && before.content.size == 0 && !before.sameMarkup(after))
      tr.setNodeType(cut - before.nodeSize, after.type, after.attrs)
    if (tr.apply(pm.apply.scroll) !== false)
      return
  }

  let conn
  if (after.isTextblock && (conn = before.type.findConnection(after.type))) {
    let tr = pm.tr, end = cut + after.nodeSize
    tr.step("ancestor", cut, end, {types: [before.type, ...conn],
                                   attrs: [before.attrs, ...conn.map(() => null)]})
    tr.join(end + 2 * conn.length + 2, 1, true)
    tr.join(cut)
    if (tr.apply(pm.apply.scroll) !== false) return
  }

  let selAfter = findSelectionFrom(pm.doc, cut, 1)
  return pm.tr.lift(selAfter.from, selAfter.to, true).apply(pm.apply.scroll)
}

// ;; #kind=command
// If the selection is empty and at the start of a textblock, move
// that block closer to the block before it, by lifting it out of its
// parent or, if it has no parent it doesn't share with the node
// before it, moving it into a parent of that node, or joining it with
// that.
//
// **Keybindings:** Backspace, Mod-Backspace
baseCommands.joinBackward = {
  label: "Join with the block above",
  run(pm) {
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
      return pm.tr.lift(head, head, true).apply(pm.apply.scroll)

    // If the node below has no content and the node above is
    // selectable, delete the node below and select the one above.
    if (before.type.contains == null && before.type.selectable && $head.parent.content.size == 0) {
      let tr = pm.tr.delete(cut, cut + $head.parent.nodeSize).apply(pm.apply.scroll)
      pm.setNodeSelection(cut - before.nodeSize)
      return tr
    }

    // If the node doesn't allow children, delete it
    if (before.type.contains == null)
      return pm.tr.delete(cut - before.nodeSize, cut).apply(pm.apply.scroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  keys: ["Backspace(30)", "Mod-Backspace(30)"]
}

// Get an offset moving backward from a current offset inside a node.
function moveBackward(doc, pos, by) {
  if (by != "char" && by != "word")
    throw new AssertionError("Unknown motion unit: " + by)

  let $pos = doc.resolve(pos)
  let parent = $pos.parent, offset = $pos.parentOffset

  let cat = null, counted = 0
  for (;;) {
    if (offset == 0) return pos
    let {offset: start, node} = parent.nodeBefore(offset)
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

// ;; #kind=command
// Delete the character before the cursor, if the selection is empty
// and the cursor isn't at the start of a textblock.
//
// **Keybindings:** Backspace, Ctrl-H (Mac)
baseCommands.deleteCharBefore = {
  label: "Delete a character before the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || pm.doc.resolve(head).parentOffset == 0) return false
    let dest = moveBackward(pm.doc, head, "char")
    return pm.tr.delete(dest, head).apply(pm.apply.scroll)
  },
  keys: {
    all: ["Backspace(60)"],
    mac: ["Ctrl-H(40)"]
  }
}

// ;; #kind=command
// Delete the word before the cursor, if the selection is empty and
// the cursor isn't at the start of a textblock.
//
// **Keybindings:** Mod-Backspace, Alt-Backspace (Mac)
baseCommands.deleteWordBefore = {
  label: "Delete the word before the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || pm.doc.resolve(head).parentOffset == 0) return false
    let dest = moveBackward(pm.doc, head, "word")
    return pm.tr.delete(dest, head).apply(pm.apply.scroll)
  },
  keys: {
    all: ["Mod-Backspace(40)"],
    mac: ["Alt-Backspace(40)"]
  }
}

// ;; #kind=command
// If the selection is empty and the cursor is at the end of a
// textblock, move the node after it closer to the node with the
// cursor (lifting it out of parents that aren't shared, moving it
// into parents of the cursor block, or joining the two when they are
// siblings).
//
// **Keybindings:** Delete, Mod-Delete
baseCommands.joinForward = {
  label: "Join with the block below",
  run(pm) {
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
    if (after.type.contains == null)
      return pm.tr.delete(cut, cut + after.nodeSize).apply(pm.apply.scroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  keys: ["Delete(30)", "Mod-Delete(30)"]
}

function moveForward(doc, pos, by) {
  if (by != "char" && by != "word")
    throw new AssertionError("Unknown motion unit: " + by)

  let $pos = doc.resolve(pos)
  let parent = $pos.parent, offset = $pos.parentOffset

  let cat = null, counted = 0
  for (;;) {
    if (offset == parent.content.size) return pos
    let {offset: start, node} = parent.nodeAfter(offset)
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

// ;; #kind=command
// Delete the character after the cursor, if the selection is empty
// and the cursor isn't at the end of its textblock.
//
// **Keybindings:** Delete, Ctrl-D (Mac)
baseCommands.deleteCharAfter = {
  label: "Delete a character after the cursor",
  run(pm) {
    let {head, empty} = pm.selection, $head
    if (!empty || ($head = pm.doc.resolve(head)).parentOffset == $head.parent.content.size) return false
    let dest = moveForward(pm.doc, head, "char")
    return pm.tr.delete(head, dest).apply(pm.apply.scroll)
  },
  keys: {
    all: ["Delete(60)"],
    mac: ["Ctrl-D(60)"]
  }
}

// ;; #kind=command
// Delete the word after the cursor, if the selection is empty and the
// cursor isn't at the end of a textblock.
//
// **Keybindings:** Mod-Delete, Ctrl-Alt-Backspace (Mac), Alt-Delete
// (Mac), Alt-D (Mac)
baseCommands.deleteWordAfter = {
  label: "Delete a word after the cursor",
  run(pm) {
    let {head, empty} = pm.selection, $head
    if (!empty || ($head = pm.doc.resolve(head)).parentOffset == $head.parent.content.size) return false
    let dest = moveForward(pm.doc, head, "word")
    return pm.tr.delete(head, dest).apply(pm.apply.scroll)
  },
  keys: {
    all: ["Mod-Delete(40)"],
    mac: ["Ctrl-Alt-Backspace(40)", "Alt-Delete(40)", "Alt-D(40)"]
  }
}

function joinPointAbove(pm) {
  let {node, from} = pm.selection
  if (node) return joinable(pm.doc, from) ? from : null
  else return joinPoint(pm.doc, from, -1)
}

// ;; #kind=command
// Join the selected block or, if there is a text selection, the
// closest ancestor block of the selection that can be joined, with
// the sibling above it.
//
// **Keybindings:** Alt-Up
baseCommands.joinUp = {
  label: "Join with above block",
  run(pm) {
    let point = joinPointAbove(pm), selectNode
    if (!point) return false
    if (pm.selection.node)
      selectNode = point - pm.doc.resolve(point).nodeBefore.nodeSize
    pm.tr.join(point).apply()
    if (selectNode != null) pm.setNodeSelection(selectNode)
  },
  select(pm) { return joinPointAbove(pm) },
  menu: {
    group: "block", rank: 80,
    display: {
      type: "icon",
      width: 800, height: 900,
      path: "M0 75h800v125h-800z M0 825h800v-125h-800z M250 400h100v-100h100v100h100v100h-100v100h-100v-100h-100z"
    }
  },
  keys: ["Alt-Up"]
}

function joinPointBelow(pm) {
  let {node, to} = pm.selection
  if (node) return joinable(pm.doc, to) ? to : null
  else return joinPoint(pm.doc, to, 1)
}

// ;; #kind=command
// Join the selected block, or the closest ancestor of the selection
// that can be joined, with the sibling after it.
//
// **Keybindings:** Alt-Down
baseCommands.joinDown = {
  label: "Join with below block",
  run(pm) {
    let node = pm.selection.node, nodeAt = pm.selection.from
    let point = joinPointBelow(pm)
    if (!point) return false
    pm.tr.join(point).apply()
    if (node) pm.setNodeSelection(nodeAt)
  },
  select(pm) { return joinPointBelow(pm) },
  keys: ["Alt-Down"]
}

// ;; #kind=command
// Lift the selected block, or the closest ancestor block of the
// selection that can be lifted, out of its parent node.
//
// **Keybindings:** Ctrl-[
baseCommands.lift = {
  label: "Lift out of enclosing block",
  run(pm) {
    let {from, to} = pm.selection
    return pm.tr.lift(from, to, true).apply(pm.apply.scroll)
  },
  select(pm) {
    let {from, to} = pm.selection
    return canLift(pm.doc, from, to)
  },
  menu: {
    group: "block", rank: 75,
    display: {
      type: "icon",
      width: 1024, height: 1024,
      path: "M219 310v329q0 7-5 12t-12 5q-8 0-13-5l-164-164q-5-5-5-13t5-13l164-164q5-5 13-5 7 0 12 5t5 12zM1024 749v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12zM1024 530v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 310v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 91v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12z"
    }
  },
  keys: ["Mod-["]
}

// ;; #kind=command
// If the selection is in a node whose type has a truthy `isCode`
// property, replace the selection with a newline character.
//
// **Keybindings:** Enter
baseCommands.newlineInCode = {
  label: "Insert newline",
  run(pm) {
    let {from, to, node} = pm.selection
    if (node) return false
    let $from = pm.doc.resolve(from)
    if (!$from.parent.type.isCode || to >= $from.end($from.depth)) return false
    return pm.tr.typeText("\n").apply(pm.apply.scroll)
  },
  keys: ["Enter(10)"]
}

// ;; #kind=command
// If a block node is selected, create an empty paragraph before (if
// it is its parent's first child) or after it.
//
// **Keybindings:** Enter
baseCommands.createParagraphNear = {
  label: "Create a paragraph near the selected block",
  run(pm) {
    let {from, to, node} = pm.selection
    if (!node || !node.isBlock) return false
    let side = pm.doc.resolve(from).parentOffset ? to : from
    pm.tr.insert(side, pm.schema.defaultTextblockType().create()).apply(pm.apply.scroll)
    pm.setTextSelection(side + 1)
  },
  keys: ["Enter(20)"]
}

// ;; #kind=command
// If the cursor is in an empty textblock that can be lifted, lift the
// block.
//
// **Keybindings:** Enter
baseCommands.liftEmptyBlock = {
  label: "Move current block up",
  run(pm) {
    let {head, empty} = pm.selection, $head
    if (!empty || ($head = pm.doc.resolve(head)).parentOffset > 0 || $head.parent.content.size) return false
    if ($head.depth > 1) {
      if ($head.offset($head.depth - 1) > 0 &&
          $head.index($head.depth - 1) < $head.node($head.depth - 1).childCount - 1 &&
          pm.tr.split($head.before($head.depth)).apply() !== false)
        return
    }
    return pm.tr.lift(head, head, true).apply(pm.apply.scroll)
  },
  keys: ["Enter(30)"]
}

// ;; #kind=command
// Split the parent block of the selection. If the selection is a text
// selection, delete it.
//
// **Keybindings:** Enter
baseCommands.splitBlock = {
  label: "Split the current block",
  run(pm) {
    let {from, to, node} = pm.selection, $from = pm.doc.resolve(from)
    if (node && node.isBlock) {
      if (!$from.parentOffset) return false
      return pm.tr.split(from).apply(pm.apply.scroll)
    } else {
      let $to = pm.doc.resolve(to), atEnd = $to.parentOffset == $to.parent.content.size
      let deflt = pm.schema.defaultTextblockType()
      let type = atEnd ? deflt : null
      let tr = pm.tr.delete(from, to).split(from, 1, type)
      if (!atEnd && !$from.parentOffset && $from.parent.type != deflt)
        tr.setNodeType($from.before($from.depth), deflt)
      return tr.apply(pm.apply.scroll)
    }
  },
  keys: ["Enter(60)"]
}

function nodeAboveSelection(pm) {
  let sel = pm.selection
  if (sel.node) {
    let $from = pm.doc.resolve(sel.from)
    return !!$from.depth && $from.before($from.depth)
  }
  let $head = pm.doc.resolve(sel.head)
  let same = $head.sameDepth(pm.doc.resolve(sel.anchor))
  return same == 0 ? false : $head.before(same)
}

// ;; #kind=command
// Move the selection to the node wrapping the current selection, if
// any. (Will not select the document node.)
//
// **Keybindings:** Esc
baseCommands.selectParentNode = {
  label: "Select parent node",
  run(pm) {
    let node = nodeAboveSelection(pm)
    if (node === false) return false
    pm.setNodeSelection(node)
  },
  select(pm) {
    return nodeAboveSelection(pm)
  },
  menu: {
    group: "block", rank: 90,
    display: {type: "icon", text: "\u2b1a", style: "font-weight: bold"}
  },
  keys: ["Esc"]
}

// ;; #kind=command
// Undo the most recent change event, if any.
//
// **Keybindings:** Mod-Z
baseCommands.undo = {
  label: "Undo last change",
  run(pm) { pm.scrollIntoView(); return pm.history.undo() },
  select(pm) { return pm.history.undoDepth > 0 },
  menu: {
    group: "history", rank: 10,
    display: {
      type: "icon",
      width: 1024, height: 1024,
      path: "M761 1024c113-206 132-520-313-509v253l-384-384 384-384v248c534-13 594 472 313 775z"
    }
  },
  keys: ["Mod-Z"]
}

// ;; #kind=command
// Redo the most recently undone change event, if any.
//
// **Keybindings:** Mod-Y, Shift-Mod-Z
baseCommands.redo = {
  label: "Redo last undone change",
  run(pm) { pm.scrollIntoView(); return pm.history.redo() },
  select(pm) { return pm.history.redoDepth > 0 },
  menu: {
    group: "history", rank: 20,
    display: {
      type: "icon",
      width: 1024, height: 1024,
      path: "M576 248v-248l384 384-384 384v-253c-446-10-427 303-313 509-280-303-221-789 313-775z"
    }
  },
  keys: ["Mod-Y", "Shift-Mod-Z"]
}
