const Keymap = require("browserkeymap")

const {Selection, verticalMotionLeavesTextblock, NodeSelection, TextSelection} = require("./selection")
const browser = require("../util/browser")

function nothing() {}

function moveSelectionBlock(pm, dir) {
  let {$from, $to, node} = pm.selection
  let $side = dir > 0 ? $to : $from
  let $start = node && node.isBlock ? $side : $side.depth ? pm.doc.resolve(dir > 0 ? $side.after() : $side.before()) : null
  return $start && Selection.findFrom($start, dir)
}

function selectNodeHorizontally(pm, dir) {
  let {empty, node, $from, $to} = pm.selection
  if (!empty && !node) return false

  if (node && node.isInline) {
    pm.setSelection(new TextSelection(dir > 0 ? $to : $from))
    return true
  }

  if (!node) {
    let {node: nextNode, offset} = dir > 0
        ? $from.parent.childAfter($from.parentOffset)
        : $from.parent.childBefore($from.parentOffset)
    if (nextNode) {
      if (nextNode.type.selectable && offset == $from.parentOffset - (dir > 0 ? 0 : nextNode.nodeSize)) {
        pm.setSelection(new NodeSelection(dir < 0 ? pm.doc.resolve($from.pos - nextNode.nodeSize) : $from))
        return true
      }
      return false
    }
  }

  let next = moveSelectionBlock(pm, dir)
  if (next && (next instanceof NodeSelection || node)) {
    pm.setSelection(next)
    return true
  }
  return false
}

function horiz(dir) {
  return pm => {
    let done = selectNodeHorizontally(pm, dir)
    if (done) pm.scrollIntoView()
    return done
  }
}

// : (ProseMirror, number)
// Check whether vertical selection motion would involve node
// selections. If so, apply it (if not, the result is left to the
// browser)
function selectNodeVertically(pm, dir) {
  let {empty, node, $from, $to} = pm.selection
  if (!empty && !node) return false

  let leavingTextblock = true, $start = dir < 0 ? $from : $to
  if (!node || node.isInline) {
    pm.flush() // verticalMotionLeavesTextblock needs an up-to-date DOM
    leavingTextblock = verticalMotionLeavesTextblock(pm, $start, dir)
  }

  if (leavingTextblock) {
    let next = moveSelectionBlock(pm, dir)
    if (next && (next instanceof NodeSelection)) {
      pm.setSelection(next)
      return true
    }
  }

  if (!node || node.isInline) return false

  let beyond = Selection.findFrom($start, dir)
  if (beyond) pm.setSelection(beyond)
  return true
}

function vert(dir) {
  return pm => {
    let done = selectNodeVertically(pm, dir)
    if (done !== false) pm.scrollIntoView()
    return done
  }
}

// A backdrop keymap used to make sure we always suppress keys that
// have a dangerous default effect, even if the commands they are
// bound to return false, and to make sure that cursor-motion keys
// find a cursor (as opposed to a node selection) when pressed. For
// cursor-motion keys, the code in the handlers also takes care of
// block selections.

let keys = {
  "Esc": nothing,
  "Enter": nothing,
  "Ctrl-Enter": nothing,
  "Mod-Enter": nothing,
  "Shift-Enter": nothing,
  "Backspace": browser.ios ? undefined : nothing,
  "Delete": nothing,
  "Mod-B": nothing,
  "Mod-I": nothing,
  "Mod-Backspace": nothing,
  "Mod-Delete": nothing,
  "Shift-Backspace": nothing,
  "Shift-Delete": nothing,
  "Shift-Mod-Backspace": nothing,
  "Shift-Mod-Delete": nothing,
  "Mod-Z": nothing,
  "Mod-Y": nothing,
  "Shift-Mod-Z": nothing,
  "Ctrl-D": nothing,
  "Ctrl-H": nothing,
  "Ctrl-Alt-Backspace": nothing,
  "Alt-D": nothing,
  "Alt-Delete": nothing,
  "Alt-Backspace": nothing,

  "Left": horiz(-1),
  "Mod-Left": horiz(-1),
  "Right": horiz(1),
  "Mod-Right": horiz(1),
  "Up": vert(-1),
  "Down": vert(1)
}

if (browser.mac) {
  keys["Alt-Left"] = horiz(-1)
  keys["Alt-Right"] = horiz(1)
  keys["Ctrl-Backspace"] = keys["Ctrl-Delete"] = nothing
}

const captureKeys = new Keymap(keys)
exports.captureKeys = captureKeys
