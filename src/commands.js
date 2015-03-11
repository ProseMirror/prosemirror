import {Node, Pos, style, replace, inline} from "./model"

const commands = Object.create(null)

export default commands

function clearSelection(pm) {
  let sel = pm.selection
  if (!sel.empty)
    pm.applyTransform(replace(pm.doc, sel.from, sel.to))
  return sel.from
}

commands.insertHardBreak = pm => {
  let pos = clearSelection(pm)
  pm.applyTransform(inline.insertNode(pm.doc, pos, new Node.Inline("hard_break")))
}

function setInlineStyle(pm, style, to) {
  let sel = pm.selection
  if (to == null)
    to = !inline.hasStyle(pm.doc, sel.head, style)
  pm.updateDoc(inline[to ? "addStyle" : "removeStyle"](pm.doc, sel.from, sel.to, style))
}

commands.makeStrong = pm => setInlineStyle(pm, style.strong, true)
commands.removeStrong = pm => setInlineStyle(pm, style.strong, false)
commands.toggleStrong = pm => setInlineStyle(pm, style.strong, null)

commands.makeEm = pm => setInlineStyle(pm, style.em, true)
commands.removeEm = pm => setInlineStyle(pm, style.em, false)
commands.toggleEm = pm => setInlineStyle(pm, style.em, null)

commands.delBackward = pm => {

}

commands.delForward = pm => {

}

commands.undo = pm => pm.history.undo()
commands.redo = pm => pm.history.redo()
