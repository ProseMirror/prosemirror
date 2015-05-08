import {Keymap} from "./keys"
import {mac} from "./dom"

const mod = mac ? "Cmd-" : "Ctrl-"

export const defaultKeymap = new Keymap({
  "Enter": "endBlock",
  [mod + "Enter"]: "insertHardBreak",
  "Backspace": "delBackward",
  "Delete": "delForward",
  [mod + "B"]: "toggleStrong",
  [mod + "I"]: "toggleEm",
  [mod + "`"]: "toggleCode",
  [mod + "Backspace"]: "delWordBackward",
  [mod + "Delete"]: "delWordForward",
  [mod + "Z"]: "undo",
  [mod + "Y"]: "redo",
  ["Shift-" + mod + "Z"]: "redo",
  "Alt-Up": "join",
  "Alt-Left": "lift",
  "Alt-Right '*'": "wrapBulletList",
  "Alt-Right '1'": "wrapOrderedList",
  "Alt-Right '>'": "wrapBlockquote",
  [mod + "H '1'"]: "makeH1",
  [mod + "H '2'"]: "makeH2",
  [mod + "H '3'"]: "makeH3",
  [mod + "H '4'"]: "makeH4",
  [mod + "H '5'"]: "makeH5",
  [mod + "H '6'"]: "makeH6",
  [mod + "P"]: "makeParagraph",
  [mod + "\\"]: "makeCodeBlock",
  [mod + "Space"]: "insertRule"
})

function add(key, val) { defaultKeymap.addBinding(key, val) }

if (mac) {
  add("Ctrl-D", "delForward")
  add("Ctrl-H", "delBackward")
  add("Ctrl-Alt-Backspace", "delWordForward")
  add("Alt-D", "delWordForward")
  add("Alt-Delete", "delWordForward")
  add("Alt-Backspace", "delWordBackward")
}
