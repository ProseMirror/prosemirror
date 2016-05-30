import Keymap from "browserkeymap"
import {HardBreak, BulletList, OrderedList, ListItem, BlockQuote, HorizontalRule,
        Paragraph, CodeBlock, Heading, StrongMark, EmMark, CodeMark} from "../schema"
import {browser} from "../dom"
import {wrapIn, setBlockType, wrapInList, splitListItem, liftListItem, sinkListItem,
        chain, newlineInCode} from "../edit/commands"
import {Plugin} from "../edit"

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
export function defaultSchemaKeymap(schema) {
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
      keys["Shift-Ctrl-8"] = pm => wrapInList(pm, node)
    if (node instanceof OrderedList)
      keys["Shift-Ctrl-9"] = pm => wrapInList(pm, node)
    if (node instanceof BlockQuote)
      keys["Shift-Ctrl-."] = pm => wrapIn(pm, node)
    if (node instanceof HardBreak) {
      let cmd = chain(newlineInCode,
                      pm => pm.tr.replaceSelection(node.create()).apply(pm.apply.scroll))
      keys["Mod-Enter"] = keys["Shift-Enter"] = cmd
      if (browser.mac) keys["Ctrl-Enter"] = cmd
    }
    if (node instanceof ListItem) {
      keys["Enter"] = pm => splitListItem(pm, node)
      keys["Mod-["] = pm => liftListItem(pm, node)
      keys["Mod-]"] = pm => sinkListItem(pm, node)
    }
    if (node instanceof Paragraph)
      keys["Shift-Ctrl-0"] = pm => setBlockType(pm, node)
    if (node instanceof CodeBlock)
      keys["Shift-Ctrl-\\"] = pm => setBlockType(pm, node)
    if (node instanceof Heading) for (let i = 1; i <= 6; i++)
      keys["Shift-Ctrl-" + i] = pm => setBlockType(pm, node, {level: i})
    if (node instanceof HorizontalRule)
      keys["Mod-Shift--"] = pm => pm.tr.replaceSelection(node.create()).apply(pm.apply.scroll)
  }
  return new Keymap(keys)
}

// :: Plugin
// A convenience plugin to automatically add a keymap created by
// `defaultSchemaKeymap` to an editor.
export const defaultSchemaKeymapPlugin = new Plugin(class {
  constructor(pm) {
    this.keymap = defaultSchemaKeymap(pm.schema)
    pm.addKeymap(this.keymap)
  }
  detach(pm) {
    pm.removeKeymap(this.keymap)
  }
})
