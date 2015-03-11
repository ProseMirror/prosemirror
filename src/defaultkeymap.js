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
  "Alt-Right '>'": "wrapBlockquote"
})
