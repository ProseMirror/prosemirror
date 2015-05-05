import {normalizeKeymap} from "./keys"
import {mac} from "./dom"

const mod = mac ? "Cmd-" : "Ctrl-"

export const defaultKeymap = {
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
}

let map = defaultKeymap

if (mac) {
  map["Ctrl-D"] = "delForward"
  map["Ctrl-H"] = "delBackward"
  map["Ctrl-Alt-Backspace"] = map["Alt-D"] = map["Alt-Delete"] = "delWordForward"
  map["Alt-Backspace"] = "delWordBackward"
}
