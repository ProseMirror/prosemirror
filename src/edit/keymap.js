const Keymap = require("browserkeymap")
const browser = require("../util/browser")

const c = require("./commands").commands

// :: Keymap

// A basic keymap containing bindings not specific to any schema.
// Binds the following keys (when multiple commands are listed, they
// are chained with [`chainCommands`](#commands.chainCommands):
//
// * **Enter** to `newlineInCode`, `createParagraphNear`, `liftEmptyBlock`, `splitBlock`
// * **Backspace** to `deleteSelection`, `joinBackward`, `deleteCharBefore`
// * **Mod-Backspace** to `deleteSelection`, `joinBackward`, `deleteWordBefore`
// * **Delete** to `deleteSelection`, `joinForward`, `deleteCharAfter`
// * **Mod-Delete** to `deleteSelection`, `joinForward`, `deleteWordAfter`
// * **Alt-Up** to `joinUp`
// * **Alt-Down** to `joinDown`
// * **Mod-[** to `lift`
// * **Esc** to `selectParentNode`
// * **Mod-Z** to `undo`
// * **Mod-Y** and **Shift-Mod-Z** to `redo`
const baseKeymap = new Keymap({
  "Enter": c.chainCommands(c.newlineInCode, c.createParagraphNear,
                           c.liftEmptyBlock, c.splitBlock),

  "Backspace": c.chainCommands(c.deleteSelection, c.joinBackward, c.deleteCharBefore),
  "Mod-Backspace": c.chainCommands(c.deleteSelection, c.joinBackward, c.deleteWordBefore),
  "Delete": c.chainCommands(c.deleteSelection, c.joinForward, c.deleteCharAfter),
  "Mod-Delete": c.chainCommands(c.deleteSelection, c.joinForward, c.deleteWordAfter),

  "Alt-Up": c.joinUp,
  "Alt-Down": c.joinDown,
  "Mod-[": c.lift,
  "Esc": c.selectParentNode,

  "Mod-Z": c.undo,
  "Mod-Y": c.redo,
  "Shift-Mod-Z": c.redo
})

if (browser.mac) baseKeymap = baseKeymap.update({
  "Ctrl-H": baseKeymap.lookup("Backspace"),
  "Alt-Backspace": baseKeymap.lookup("Mod-Backspace"),
  "Ctrl-D": baseKeymap.lookup("Delete"),
  "Ctrl-Alt-Backspace": baseKeymap.lookup("Mod-Delete"),
  "Alt-Delete": baseKeymap.lookup("Mod-Delete"),
  "Alt-D": baseKeymap.lookup("Mod-Delete")
})

exports.baseKeymap = baseKeymap
