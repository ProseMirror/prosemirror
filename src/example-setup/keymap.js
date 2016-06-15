const Keymap = require("browserkeymap")
const {HardBreak, BulletList, OrderedList, ListItem, BlockQuote, HorizontalRule, Paragraph, CodeBlock, Heading,
       StrongMark, EmMark, CodeMark} = require("../schema-basic")
const browser = require("../util/browser")
const {wrapIn, setBlockType, wrapInList, splitListItem, liftListItem, sinkListItem, chainCommands, newlineInCode,
       toggleMark} = require("../edit").commands

// :: (Schema, ?Object) → Keymap
// Inspect the given schema looking for marks and nodes from the
// basic schema, and if found, add key bindings related to them.
// This will add:
//
// * **Mod-B** for toggling [strong](#StrongMark)
// * **Mod-I** for toggling [emphasis](#EmMark)
// * **Mod-\`** for toggling [code font](#CodeMark)
// * **Ctrl-Shift-0** for making the current textblock a paragraph
// * **Ctrl-Shift-1** to **Ctrl-Shift-6** for making the current
//   textblock a heading of the corresponding level
// * **Ctrl-Shift-\\** to make the current textblock a code block
// * **Ctrl-Shift-8** to wrap the selection in an ordered list
// * **Ctrl-Shift-9** to wrap the selection in a bullet list
// * **Ctrl-Shift-.** to wrap the selection in a block quote
// * **Enter** to split a non-empty textblock in a list item while at
//   the same time splitting the list item
// * **Mod-Enter** to insert a hard break
// * **Mod-Shift-minus** to insert a horizontal rule
//
// You can suppress or map these bindings by passing a `mapKeys`
// argument, which maps key names (say `"Mod-B"` to either `false`, to
// remove the binding, or a new key name string.
function buildKeymap(schema, mapKeys) {
  let keys = {}
  function bind(key, cmd) {
    if (mapKeys) {
      let mapped = mapKeys[key]
      if (mapped === false) return
      if (mapped) key = mapped
    }
    keys[key] = cmd
  }

  for (let name in schema.marks) {
    let mark = schema.marks[name]
    if (mark instanceof StrongMark)
      bind("Mod-B", toggleMark(mark))
    if (mark instanceof EmMark)
      bind("Mod-I", toggleMark(mark))
    if (mark instanceof CodeMark)
      bind("Mod-`", toggleMark(mark))
  }
  for (let name in schema.nodes) {
    let node = schema.nodes[name]
    if (node instanceof BulletList)
      bind("Shift-Ctrl-8", wrapInList(node))
    if (node instanceof OrderedList)
      bind("Shift-Ctrl-9", wrapInList(node))
    if (node instanceof BlockQuote)
      bind("Shift-Ctrl-.", wrapIn(node))
    if (node instanceof HardBreak) {
      let cmd = chainCommands(newlineInCode,
                              pm => pm.tr.replaceSelection(node.create()).applyAndScroll())
      bind("Mod-Enter", cmd)
      bind("Shift-Enter", cmd)
      if (browser.mac) bind("Ctrl-Enter", cmd)
    }
    if (node instanceof ListItem) {
      bind("Enter", splitListItem(node))
      bind("Mod-[", liftListItem(node))
      bind("Mod-]", sinkListItem(node))
    }
    if (node instanceof Paragraph)
      bind("Shift-Ctrl-0", setBlockType(node))
    if (node instanceof CodeBlock)
      bind("Shift-Ctrl-\\", setBlockType(node))
    if (node instanceof Heading) for (let i = 1; i <= 6; i++)
      bind("Shift-Ctrl-" + i, setBlockType(node, {level: i}))
    if (node instanceof HorizontalRule)
      bind("Mod-Shift--", pm => pm.tr.replaceSelection(node.create()).applyAndScroll())
  }
  return new Keymap(keys)
}
exports.buildKeymap = buildKeymap
