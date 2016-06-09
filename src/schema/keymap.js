const Keymap = require("browserkeymap")
const {HardBreak, BulletList, OrderedList, ListItem, BlockQuote, HorizontalRule, Paragraph, CodeBlock, Heading, StrongMark, EmMark, CodeMark} = require("../schema")
const browser = require("../util/browser")
const {wrapIn, setBlockType, wrapInList, splitListItem, liftListItem, sinkListItem, chain, newlineInCode} = require("../edit/commands")
const {Plugin} = require("../edit")

// !! Helper utilities for assigning key bindings to functionality
// related to the basic schema.

// :: (Schema) → Keymap
// Inspect the given schema looking for marks and nodes from the
// default schema, and if found, add key bindings related to them.
// This will add:
//
// * **Ctrl/Cmd-B** for toggling [strong](#StrongMark)
// * **Ctrl/Cmd-I** for toggling [emphasis](#EmMark)
// * **Ctrl/Cmd-\`** for toggling [code font](#CodeMark)
// * **Ctrl-Shift-0** for making the current textblock a paragraph
// * **Ctrl-Shift-1** to **Ctrl-Shift-6** for making the current
//   textblock a heading of the corresponding level
// * **Ctrl-Shift-\\** to make the current textblock a code block
// * **Ctrl-Shift-8** to wrap the selection in an ordered list
// * **Ctrl-Shift-9** to wrap the selection in a bullet list
// * **Ctrl-Shift-.** to wrap the selection in a block quote
// * **Enter** to split a non-empty textblock in a list item while at
//   the same time splitting the list item
// * **Ctrl/Cmd-Enter** to insert a hard break
// * **Ctrl/Cmd-Shift-minus** to insert a horizontal rule
function defaultSchemaKeymap(schema) {
  let keys = {}
  for (let name in schema.marks) {
    let mark = schema.marks[name]
    if (mark instanceof StrongMark)
      keys["Mod-B"] = pm => pm.setMark(mark, null)
    if (mark instanceof EmMark)
      keys["Mod-I"] = pm => pm.setMark(mark, null)
    if (mark instanceof CodeMark)
      keys["Mod-`"] = pm => pm.setMark(mark, null)
  }
  for (let name in schema.nodes) {
    let node = schema.nodes[name]
    if (node instanceof BulletList)
      keys["Shift-Ctrl-8"] = wrapInList(node)
    if (node instanceof OrderedList)
      keys["Shift-Ctrl-9"] = wrapInList(node)
    if (node instanceof BlockQuote)
      keys["Shift-Ctrl-."] = wrapIn(node)
    if (node instanceof HardBreak) {
      let cmd = chain(newlineInCode,
                      pm => pm.tr.replaceSelection(node.create()).applyAndScroll())
      keys["Mod-Enter"] = keys["Shift-Enter"] = cmd
      if (browser.mac) keys["Ctrl-Enter"] = cmd
    }
    if (node instanceof ListItem) {
      keys["Enter"] = splitListItem(node)
      keys["Mod-["] = liftListItem(node)
      keys["Mod-]"] = sinkListItem(node)
    }
    if (node instanceof Paragraph)
      keys["Shift-Ctrl-0"] = setBlockType(node)
    if (node instanceof CodeBlock)
      keys["Shift-Ctrl-\\"] = setBlockType(node)
    if (node instanceof Heading) for (let i = 1; i <= 6; i++)
      keys["Shift-Ctrl-" + i] = setBlockType(node, {level: i})
    if (node instanceof HorizontalRule)
      keys["Mod-Shift--"] = pm => pm.tr.replaceSelection(node.create()).applyAndScroll()
  }
  return new Keymap(keys)
}
exports.defaultSchemaKeymap = defaultSchemaKeymap

// :: Plugin
// A convenience plugin to automatically add a keymap created by
// `defaultSchemaKeymap` to an editor.
const defaultSchemaKeymapPlugin = new Plugin(class {
  constructor(pm) {
    this.keymap = defaultSchemaKeymap(pm.schema)
    pm.addKeymap(this.keymap)
  }
  detach(pm) {
    pm.removeKeymap(this.keymap)
  }
})
exports.defaultSchemaKeymapPlugin = defaultSchemaKeymapPlugin
