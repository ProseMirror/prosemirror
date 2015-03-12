import {normalizeKeymap} from "./keys"

export default normalizeKeymap({
  "Enter": "endBlock",
  "Ctrl-Enter": "insertHardBreak",
  "Ctrl-B": "toggleStrong",
  "Ctrl-I": "toggleEm",
  "Backspace": "delBackward",
  "Delete": "delForward",
  "Ctrl-Z": "undo",
  "Ctrl-Y": "redo",
  "Shift-Ctrl-Z": "redo",
  "Alt-Up": "join",
  "Alt-Left": "lift",
  "Alt-Right '*'": "wrapBulletList",
  "Alt-Right '1'": "wrapOrderedList",
  "Alt-Right '>'": "wrapBlockquote",
  "Ctrl-H '1'": "makeH1",
  "Ctrl-H '2'": "makeH2",
  "Ctrl-H '3'": "makeH3",
  "Ctrl-H '4'": "makeH4",
  "Ctrl-H '5'": "makeH5",
  "Ctrl-H '6'": "makeH6",
  "Ctrl-P": "makeParagraph",
  "Ctrl-`": "makeCodeBlock",
  "Ctrl-Space": "insertRule"
})

// FIXME ctrl-backspace, ctrl-delete
// FIXME mac-style bindings
