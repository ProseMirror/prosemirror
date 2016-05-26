import Keymap from "browserkeymap"
import {browser} from "../dom"

import * as c from "./base_commands"

// :: (ProseMirror) → bool
// The default binding for enter. Tries `newlineInCode`,
// `createParagraphNear`, `liftEmptyBlock`, and `splitTextblock` in
// order.
export const defaultEnter = c.chain(c.newlineInCode,
                                    c.createParagraphNear,
                                    c.liftEmptyBlock,
                                    c.splitBlock)

export const baseKeymap = new Keymap({
  "Enter": defaultEnter,

  "Backspace": c.chain(c.deleteSelection, c.joinBackward, c.deleteCharBefore),
  "Mod-Backspace": c.chain(c.deleteSelection, c.joinBackward, c.deleteWordBefore),
  "Delete": c.chain(c.deleteSelection, c.joinForward, c.deleteCharAfter),
  "Mod-Delete": c.chain(c.deleteSelection, c.joinForward, c.deleteWordAfter),

  "Alt-Up": c.joinUp,
  "Alt-Down": c.joinDown,
  "Mod-[": c.lift,
  "Esc": c.selectParentNode,

  "Mod-Z": c.undo,
  "Mod-Y": c.redo,
  "Shift-Mod-Z": c.redo
})

if (browser.mac) baseKeymap.addBindings({
  "Ctrl-H": baseKeymap.lookup("Backspace"),
  "Alt-Backspace": baseKeymap.lookup("Mod-Backspace"),
  "Ctrl-D": baseKeymap.lookup("Delete"),
  "Ctrl-Alt-Backspace": baseKeymap.lookup("Mod-Delete"),
  "Alt-Delete": baseKeymap.lookup("Mod-Delete"),
  "Alt-D": baseKeymap.lookup("Mod-Delete")
})
