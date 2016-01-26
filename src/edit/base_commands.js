import {Pos} from "../model"
import {joinPoint, joinableBlocks, canLift} from "../transform"
import sortedInsert from "../util/sortedinsert"
import {AssertionError} from "../util/error"

import {charCategory, isExtendingChar} from "./char"
import {findSelectionFrom, verticalMotionLeavesTextblock, setDOMSelectionToPos, NodeSelection} from "./selection"

// :: Object<CommandSpec>
// The set of default commands defined by the core library. They are
// included in the [default command set](#CommandSet.default).
export const baseCommands = Object.create(null)

// Get an offset moving backward from a current offset inside a node.
function moveBackward(parent, offset, by) {
  if (by != "char" && by != "word")
    AssertionError.raise("Unknown motion unit: " + by)

  let cat = null, counted = 0
  for (;;) {
    if (offset == 0) return offset
    let {start, node} = parent.chunkBefore(offset)
    if (!node.isText) return cat ? offset : offset - 1

    if (by == "char") {
      for (let i = offset - start; i > 0; i--) {
        if (!isExtendingChar(node.text.charAt(i - 1)))
          return offset - 1
        offset--
      }
    } else if (by == "word") {
      // Work from the current position backwards through text of a singular
      // character category (e.g. "cat" of "#!*") until reaching a character in a
      // different category (i.e. the end of the word).
      for (let i = offset - start; i > 0; i--) {
        let nextCharCat = charCategory(node.text.charAt(i - 1))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return offset
        offset--
        counted++
      }
    }
  }
}

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
  let around = pm.doc.path(cut.path)
  let before = around.child(cut.offset - 1), after = around.child(cut.offset)
  if (before.type.canContainContent(after.type) && pm.tr.join(cut).apply(pm.apply.scroll) !== false)
    return

  let conn
  if (after.isTextblock && (conn = before.type.findConnection(after.type))) {
    let tr = pm.tr, end = cut.move(1)
    tr.step("ancestor", cut, end, null, {types: [before.type, ...conn],
                                         attrs: [before.attrs, ...conn.map(() => null)]})
    tr.join(end)
    tr.join(cut)
    if (tr.apply(pm.apply.scroll) !== false) return
  }

  let selAfter = findSelectionFrom(pm.doc, cut, 1)
  return pm.tr.lift(selAfter.from, selAfter.to).apply(pm.apply.scroll)
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
    if (!empty || head.offset > 0) return false

    // Find the node before this one
    let before, cut
    for (let i = head.path.length - 1; !before && i >= 0; i--) if (head.path[i] > 0) {
      cut = head.shorten(i)
      before = pm.doc.path(cut.path).child(cut.offset - 1)
    }

    // If there is no node before this, try to lift
    if (!before)
      return pm.tr.lift(head).apply(pm.apply.scroll)

    // If the node doesn't allow children, delete it
    if (before.type.contains == null)
      return pm.tr.delete(cut.move(-1), cut).apply(pm.apply.scroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  keys: ["Backspace(30)", "Mod-Backspace(30)"]
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
    if (!empty || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "char")
    return pm.tr.delete(new Pos(head.path, from), head).apply(pm.apply.scroll)
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
    if (!empty || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "word")
    return pm.tr.delete(new Pos(head.path, from), head).apply(pm.apply.scroll)
  },
  keys: {
    all: ["Mod-Backspace(40)"],
    mac: ["Alt-Backspace(40)"]
  }
}

function moveForward(parent, offset, by) {
  if (by != "char" && by != "word")
    AssertionError.raise("Unknown motion unit: " + by)

  let cat = null, counted = 0
  for (;;) {
    if (offset == parent.size) return offset
    let {start, node} = parent.chunkAfter(offset)
    if (!node.isText) return cat ? offset : offset + 1

    if (by == "char") {
      for (let i = offset - start; i < node.text.length; i++) {
        if (!isExtendingChar(node.text.charAt(i + 1)))
          return offset + 1
        offset++
      }
    } else if (by == "word") {
      for (let i = offset - start; i < node.text.length; i++) {
        let nextCharCat = charCategory(node.text.charAt(i))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return offset
        offset++
        counted++
      }
    }
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
    let {head, empty} = pm.selection
    if (!empty || head.offset < pm.doc.path(head.path).size) return false

    // Find the node after this one
    let after, cut
    for (let i = head.path.length - 1; !after && i >= 0; i--) {
      cut = head.shorten(i, 1)
      let parent = pm.doc.path(cut.path)
      if (cut.offset < parent.size)
        after = parent.child(cut.offset)
    }

    // If there is no node after this, there's nothing to do
    if (!after) return false

    // If the node doesn't allow children, delete it
    if (after.type.contains == null)
      return pm.tr.delete(cut, cut.move(1)).apply(pm.apply.scroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  keys: ["Delete(30)", "Mod-Delete(30)"]
}

// ;; #kind=command
// Delete the character after the cursor, if the selection is empty
// and the cursor isn't at the end of its textblock.
//
// **Keybindings:** Delete, Ctrl-D (Mac)
baseCommands.deleteCharAfter = {
  label: "Delete a character after the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == pm.doc.path(head.path).size) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "char")
    return pm.tr.delete(head, new Pos(head.path, to)).apply(pm.apply.scroll)
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
    let {head, empty} = pm.selection
    if (!empty || head.offset == pm.doc.path(head.path).size) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "word")
    return pm.tr.delete(head, new Pos(head.path, to)).apply(pm.apply.scroll)
  },
  keys: {
    all: ["Mod-Delete(40)"],
    mac: ["Ctrl-Alt-Backspace(40)", "Alt-Delete(40)", "Alt-D(40)"]
  }
}

function joinPointAbove(pm) {
  let {node, from} = pm.selection
  if (node) return joinableBlocks(pm.doc, from) ? from : null
  else return joinPoint(pm.doc, from, -1)
}

// ;; #kind=command
// Join the selected block or, if there is a text selection, the
// closest ancestor block of the selection that can be joined, with
// the sibling above it.
//
// **Keybindings:** Alt-Up
//
// Registers itself in the block [menu group](#CommandSpec.menuGroup)
baseCommands.joinUp = {
  label: "Join with above block",
  run(pm) {
    let point = joinPointAbove(pm), isNode = pm.selection.node
    if (!point) return false
    pm.tr.join(point).apply()
    if (isNode) pm.setNodeSelection(point.move(-1))
  },
  select(pm) { return joinPointAbove(pm) },
  menuGroup: "block(80)",
  display: {
    type: "icon",
    width: 800, height: 900,
    path: "M0 75h800v125h-800z M0 825h800v-125h-800z M250 400h100v-100h100v100h100v100h-100v100h-100v-100h-100z"
  },
  keys: ["Alt-Up"]
}

function joinPointBelow(pm) {
  let {node, to} = pm.selection
  if (node) return joinableBlocks(pm.doc, to) ? to : null
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
    let node = pm.selection.node
    let point = joinPointBelow(pm)
    if (!point) return false
    pm.tr.join(point).apply()
    if (node) pm.setNodeSelection(point.move(-1))
  },
  select(pm) { return joinPointBelow(pm) },
  keys: ["Alt-Down"]
}

// ;; #kind=command
// Lift the selected block, or the closest ancestor block of the
// selection that can be lifted, out of its parent node.
//
// **Keybindings:** Alt-Left
//
// Registers itself in the block [menu group](#CommandSpec.menuGroup).
baseCommands.lift = {
  label: "Lift out of enclosing block",
  run(pm) {
    let {from, to} = pm.selection
    return pm.tr.lift(from, to).apply(pm.apply.scroll)
  },
  select(pm) {
    let {from, to} = pm.selection
    return canLift(pm.doc, from, to)
  },
  menuGroup: "block(75)",
  display: {
    type: "icon",
    width: 1024, height: 1024,
    path: "M219 310v329q0 7-5 12t-12 5q-8 0-13-5l-164-164q-5-5-5-13t5-13l164-164q5-5 13-5 7 0 12 5t5 12zM1024 749v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12zM1024 530v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 310v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 91v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12z"
  },
  keys: ["Alt-Left"]
}

// ;; #kind=command
// If the selection is in a node whose type has a truthy `isCode`
// property, replace the selection with a newline character.
//
// **Keybindings:** Enter
baseCommands.newlineInCode = {
  label: "Insert newline",
  run(pm) {
    let {from, to, node} = pm.selection, block
    if (!node && Pos.samePath(from.path, to.path) &&
        (block = pm.doc.path(from.path)).type.isCode &&
        to.offset < block.size)
      return pm.tr.typeText("\n").apply(pm.apply.scroll)
    else
      return false
  },
  keys: ["Enter(10)"]
}

// ;; #kind=command
// If a content-less block node is selected, create an empty paragraph
// before (if it is its parent's first child) or after it.
//
// **Keybindings:** Enter
baseCommands.createParagraphNear = {
  label: "Create a paragraph near the selected leaf block",
  run(pm) {
    let {from, to, node} = pm.selection
    if (!node || !node.isBlock || node.type.contains) return false
    let side = from.offset ? to : from
    pm.tr.insert(side, pm.schema.defaultTextblockType().create()).apply(pm.apply.scroll)
    pm.setTextSelection(new Pos(side.toPath(), 0))
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
    let {head, empty} = pm.selection
    if (!empty || head.offset > 0 || pm.doc.path(head.path).size) return false
    if (head.depth > 1) {
      let shorter = head.shorten()
      if (shorter.offset > 0 && shorter.offset < pm.doc.path(shorter.path).size - 1 &&
          pm.tr.split(shorter).apply() !== false)
        return
    }
    return pm.tr.lift(head).apply(pm.apply.scroll)
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
    let {from, to, node} = pm.selection, block = pm.doc.path(to.path)
    if (node && node.isBlock) {
      if (!from.offset) return false
      return pm.tr.split(from).apply(pm.apply.scroll)
    } else {
      let deflt = pm.schema.defaultTextblockType()
      let type = to.offset == block.size ? deflt : null
      let tr = pm.tr.delete(from, to).split(from, 1, type)
      if (to.offset < block.size && !from.offset && pm.doc.path(from.path).type != deflt)
        tr.setNodeType(from.shorten(), deflt)
      return tr.apply(pm.apply.scroll)
    }
  },
  keys: ["Enter(60)"]
}

// ;; #kind=command
// Change the type of the selected textblocks. Takes one parameter,
// `type`, which should be a `{type: NodeType, attrs: ?Object}`
// object, giving the new type and its attributes.
//
// Available types are determined by enumerating the values
// [registered](#SchemaItem.register) on the schema under the
// `"textblockMenu"` namespace. They should have the form `{label:
// string, rank: ?number, attrs: ?Object}`.
//
// Registers itself in the block [menu group](#CommandSpec.menuGroup),
// where it creates the textblock type dropdown.
baseCommands.textblockType = {
  label: "Change block type",
  run(pm, value) {
    let {from, to} = pm.selection
    return pm.tr.setBlockType(from, to, value.type, value.info.attrs).apply()
  },
  select(pm) {
    let {node} = pm.selection
    return !node || node.isTextblock
  },
  params: [
    {label: "Type", type: "select", options: listTextblockTypes, prefill: currentTextblockType, defaultLabel: "Type..."}
  ],
  display: {
    type: "param"
  },
  menuGroup: "block(10)"
}

function rank(obj) { return obj.rank == null ? 50 : obj.rank }

function listTextblockTypes(pm) {
  return pm.schema.cached.textblockMenuOptions ||
    (pm.schema.cached.textblockMenuOptions = buildTextblockTypes(pm.schema))
}

function buildTextblockTypes(schema) {
  let found = []
  schema.registry("textblockMenu", (_, info, type) => {
    sortedInsert(found, {label: info.label, value: {type, info}},
                 (a, b) => rank(a.value.info) - rank(b.value.info))
  })
  return found
}

function currentTextblockType(pm) {
  let {from, to, node} = pm.selection
  if (!node || node.isInline) {
    if (!Pos.samePath(from.path, to.path)) return null
    node = pm.doc.path(from.path)
  } else if (!node.isTextblock) {
    return null
  }
  let types = listTextblockTypes(pm)
  for (let i = 0; i < types.length; i++) {
    let tp = types[i], val = tp.value
    if (node.hasMarkup(val.type, val.info.attrs)) return tp.value
  }
}

function nodeAboveSelection(pm) {
  let sel = pm.selection, i = 0
  if (sel.node) return !!sel.from.depth && sel.from.shorten()
  for (; i < sel.head.depth && i < sel.anchor.depth; i++)
    if (sel.head.path[i] != sel.anchor.path[i]) break
  return i == 0 ? false : sel.head.shorten(i - 1)
}

// ;; #kind=command
// Replace the selection with a node chosen from a drop-down. Takes
// its options values [registered](#SchemaItem.register) under the
// `"insertMenu"` namespace. These should have the form `{label:
// string, rank: ?number, attrs: ?Object, command: ?string}`. `rank`
// determines the order in which the options appear (lowest first). If
// a `command` property is given, the command named by that string,
// prefixed with the node type name and a colon, will be executed when
// the option is chosen. If not, a node of type is created, with
// attributes from the `attrs` property, and used to replace the
// selection.
//
// Registers itself in the insert [menu group](#CommandSpec.menuGroup)

baseCommands.insert = {
  label: "Insert an element",
  run(pm, value) {
    if (value.info.command)
      return pm.execCommand(value.type.name + ":" + value.info.command)
    else
      return pm.tr.replaceSelection(value.type.create(value.info.attrs)).apply(pm.apply.scroll)
  },
  select(pm) {
    return currentInsertOptions(pm).length > 0
  },
  params: [
    {label: "Type", type: "select", options: currentInsertOptions, defaultLabel: "Insert"}
  ],
  display: {
    type: "param"
  },
  menuGroup: "insert"
}

function listInsertOptions(pm) {
  return pm.schema.cached.insertMenuOptions ||
    (pm.schema.cached.insertMenuOptions = buildInsertOptions(pm.schema))
}

function buildInsertOptions(schema) {
  let found = []
  schema.registry("insertMenu", (_, info, type) => {
    sortedInsert(found, {label: info.label, value: {type, info}},
                 (a, b) => rank(a.value.info) - rank(b.value.info))
  })
  return found
}

function currentInsertOptions(pm) {
  return listInsertOptions(pm).filter(option => {
    let cmd = option.value.info.command
    if (cmd) {
      let found = pm.commands[option.value.type.name + ":" + cmd]
      return found && found.select(pm)
    } else {
      return option.value.type.isBlock ||
        pm.doc.path(pm.selection.from.path).type.canContainType(option.value.type)
    }
  })
}

// ;; #kind=command
// Move the selection to the node wrapping the current selection, if
// any. (Will not select the document node.)
//
// **Keybindings:** Esc
//
// Registers itself in the block [menu group](#CommandSpec.menuGroup).
baseCommands.selectParentNode = {
  label: "Select parent node",
  run(pm) {
    let node = nodeAboveSelection(pm)
    if (!node) return false
    pm.setNodeSelection(node)
  },
  select(pm) {
    return nodeAboveSelection(pm)
  },
  menuGroup: "block(90)",
  display: {type: "icon", text: "\u2b1a", style: "font-weight: bold; vertical-align: 20%"},
  keys: ["Esc"]
}

function moveSelectionBlock(pm, dir) {
  let {from, to, node} = pm.selection
  let side = dir > 0 ? to : from
  return findSelectionFrom(pm.doc, node && node.isBlock ? side : side.shorten(null, dir > 0 ? 1 : 0), dir)
}

function selectNodeHorizontally(pm, dir) {
  let {empty, node, from, to} = pm.selection
  if (!empty && !node) return false

  if (node && node.isInline) {
    pm.setTextSelection(dir > 0 ? to : from)
    return true
  }

  let parent
  if (!node && (parent = pm.doc.path(from.path)) &&
      (dir > 0 ? from.offset < parent.size : from.offset)) {
    let {node: nextNode, start} = dir > 0 ? parent.chunkAfter(from.offset) : parent.chunkBefore(from.offset)
    if (nextNode.type.selectable && start == from.offset - (dir > 0 ? 0 : 1)) {
      pm.setNodeSelection(dir < 0 ? from.move(-1) : from)
      return true
    }
    return false
  }

  let next = moveSelectionBlock(pm, dir)
  if (next && (next instanceof NodeSelection || node)) {
    pm.setSelectionDirect(next)
    return true
  }
  return false
}

// ;; #kind=command
// Select the node directly before the cursor, if any.
//
// **Keybindings:** Left, Mod-Left
baseCommands.selectNodeLeft = {
  label: "Move the selection onto or out of the block to the left",
  run(pm) {
    let done = selectNodeHorizontally(pm, -1)
    if (done) pm.scrollIntoView()
    return done
  },
  keys: ["Left", "Mod-Left"]
}

// ;; #kind=command
// Select the node directly after the cursor, if any.
//
// **Keybindings:** Right, Mod-Right
baseCommands.selectNodeRight = {
  label: "Move the selection onto or out of the block to the right",
  run(pm) {
    let done = selectNodeHorizontally(pm, 1)
    if (done) pm.scrollIntoView()
    return done
  },
  keys: ["Right", "Mod-Right"]
}

function selectNodeVertically(pm, dir) {
  let {empty, node, from, to} = pm.selection
  if (!empty && !node) return false

  let leavingTextblock = true
  if (!node || node.isInline)
    leavingTextblock = verticalMotionLeavesTextblock(pm, dir > 0 ? to : from, dir)

  if (leavingTextblock) {
    let next = moveSelectionBlock(pm, dir)
    if (next && (next instanceof NodeSelection)) {
      pm.setSelectionDirect(next)
      if (!node) pm.sel.lastNonNodePos = from
      return true
    }
  }

  if (!node) return false

  if (node.isInline) {
    setDOMSelectionToPos(pm, from)
    return false
  }

  let last = pm.sel.lastNonNodePos
  let beyond = findSelectionFrom(pm.doc, dir < 0 ? from : to, dir)
  if (last && beyond && Pos.samePath(last.path, beyond.from.path)) {
    setDOMSelectionToPos(pm, last)
    return false
  }
  pm.setSelectionDirect(beyond)
  return true
}

// ;; #kind=command
// Select the node directly above the cursor, if any.
//
// **Keybindings:** Up
baseCommands.selectNodeUp = {
  label: "Move the selection onto or out of the block above",
  run(pm) {
    let done = selectNodeVertically(pm, -1)
    if (done !== false) pm.scrollIntoView()
    return done
  },
  keys: ["Up"]
}

// ;; #kind=command
// Select the node directly below the cursor, if any.
//
// **Keybindings:** Down
baseCommands.selectNodeDown = {
  label: "Move the selection onto or out of the block below",
  run(pm) {
    let done = selectNodeVertically(pm, 1)
    if (done !== false) pm.scrollIntoView()
    return done
  },
  keys: ["Down"]
}

// ;; #kind=command
// Undo the most recent change event, if any.
//
// **Keybindings:** Mod-Z
//
// Registers itself in the history [menu group](#CommandSpec.menuGroup).
baseCommands.undo = {
  label: "Undo last change",
  run(pm) { pm.scrollIntoView(); return pm.history.undo() },
  select(pm) { return pm.history.canUndo() },
  menuGroup: "history(10)",
  display: {
    type: "icon",
    width: 1024, height: 1024,
    path: "M761 1024c113-206 132-520-313-509v253l-384-384 384-384v248c534-13 594 472 313 775z"
  },
  keys: ["Mod-Z"]
}

// ;; #kind=command
// Redo the most recently undone change event, if any.
//
// **Keybindings:** Mod-Y, Shift-Mod-Z
//
// Registers itself in the history [menu group](#CommandSpec.menuGroup).
baseCommands.redo = {
  label: "Redo last undone change",
  run(pm) { pm.scrollIntoView(); return pm.history.redo() },
  select(pm) { return pm.history.canRedo() },
  menuGroup: "history(20)",
  display: {
    type: "icon",
    width: 1024, height: 1024,
    path: "M576 248v-248l384 384-384 384v-253c-446-10-427 303-313 509-280-303-221-789 313-775z"
  },
  keys: ["Mod-Y", "Shift-Mod-Z"]
}
