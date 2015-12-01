import {setDOMSelectionToPos, findSelectionNear} from "./selection"
import {browser} from "../dom"
import {Keymap} from "./keys"

function nothing() {}

function ensureSelection(pm) {
  if (pm.selection.node) {
    let found = findSelectionNear(pm.doc, pm.selection.from, 1, true)
    if (found) setDOMSelectionToPos(pm, found.head)
  }
  return false
}

// A backdrop keymap used to make sure we always suppress keys that
// have a dangerous default effect, even if the commands they are
// bound to return false, and to make sure that cursor-motion keys
// find a cursor (as opposed to a node selection) when pressed.

let keys = {
  "Esc": nothing,
  "Enter": nothing,
  "Mod-Enter": nothing,
  "Shift-Enter": nothing,
  "Backspace": nothing,
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

  "Mod-A": ensureSelection
}

;["Left", "Right", "Up", "Down", "Home", "End", "PageUp", "PageDown"].forEach(key => {
  keys[key] = keys["Shift-" + key] = keys["Mod-" + key] = keys["Shift-Mod-" + key] =
    keys["Alt-" + key] = keys["Shift-Alt-" + key] = ensureSelection
})
;["Left", "Mod-Left", "Right", "Mod-Right", "Up", "Down"].forEach(key => delete keys[key])

if (browser.mac)
  keys["Ctrl-F"] = keys["Ctrl-B"] = keys["Ctrl-P"] = keys["Ctrl-N"] =
    keys["Alt-F"] = keys["Alt-B"] = keys["Ctrl-A"] = keys["Ctrl-E"] =
    keys["Ctrl-V"] = keys["goPageUp"] = ensureSelection

export const captureKeys = new Keymap(keys)
