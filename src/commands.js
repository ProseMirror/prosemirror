import {Node, Pos, style, inline} from "./model"

const commands = Object.create(null)

export default commands

function clearSelection(pm) {
  let sel = pm.selection
  if (!sel.empty)
    pm.apply({name: "replace", pos: sel.from, end: sel.to})
  return sel.from
}

commands.insertHardBreak = pm => {
  let pos = clearSelection(pm)
  pm.apply({name: "insertInline", pos: pos, type: "hard_break"})
}

function setInlineStyle(pm, style, to) {
  let sel = pm.selection
  if (to == null)
    to = !inline.hasStyle(pm.doc, sel.head, style)
  pm.apply({name: to ? "addStyle" : "removeStyle",
            pos: sel.from, end: sel.to,
            style: style})
}

commands.makeStrong = pm => setInlineStyle(pm, style.strong, true)
commands.removeStrong = pm => setInlineStyle(pm, style.strong, false)
commands.toggleStrong = pm => setInlineStyle(pm, style.strong, null)

commands.makeEm = pm => setInlineStyle(pm, style.em, true)
commands.removeEm = pm => setInlineStyle(pm, style.em, false)
commands.toggleEm = pm => setInlineStyle(pm, style.em, null)

function delBlockBackward(pm, pos) {
  if (pos.path.length == 1) { // Top level block, join with block above
    let before = Pos.before(pm.doc, new Pos([], pos.path[0], false))
    if (before)
      pm.apply({name: "replace", pos: before, end: pos})
    else if (pos.path[0] > 0)
      pm.apply({name: "remove", pos: new Pos([], pos.path[0] - 1, false)})
    return
  }

  let last = pos.path.length - 1
  let parent = pm.doc.path(pos.path.slice(0, last))
  let offset = pos.path[last]
  if (parent.type == Node.types.list_item &&
      offset == 0 && pos.path[last - 1] > 0) {
    // Top of list item below other list item
    // Join with the one above
    pm.apply({name: "join", pos: pos})
  } else {
    // Any other nested block, lift up
    pm.apply({name: "lift", pos: pos})
  }
}

commands.delBackward = pm => {
  let sel = pm.selection, head = sel.head
  if (!sel.empty)
    clearSelection(pm)
  else if (sel.head.offset)
    pm.apply({name: "replace", pos: new Pos(head.path, head.offset - 1), end: head})
  else
    delBlockBackward(pm, head)
}

function delBlockForward(pm, pos) {
  let lst = pos.path.length - 1
  let after = Pos.after(pm.doc, new Pos(pos.path.slice(0, lst), pos.path[lst] + 1, false))
  if (after)
    pm.apply({name: "replace", pos: pos, end: after})
  else if (pos.path[0] < pm.doc.content.length)
    pm.apply({name: "remove", pos: new Pos([], offset + 1, false)})
}

commands.delForward = pm => {
  let sel = pm.selection, head = sel.head
  if (!sel.empty)
    clearSelection(pm)
  else if (head.offset < pm.doc.path(head.path).size)
    pm.apply({name: "replace", pos: head, end: new Pos(head.path, head.offset + 1)})
  else
    delBlockForward(pm, head)
}

commands.undo = pm => pm.history.undo()
commands.redo = pm => pm.history.redo()

commands.join = pm => pm.apply({name: "join", pos: pm.selection.head})

commands.lift = pm => {
  let sel = pm.selection
  pm.apply({name: "lift", pos: sel.from, end: sel.to})
}

function wrap(pm, type) {
  let sel = pm.selection
  pm.apply({name: "wrap", pos: sel.from, end: sel.to, type: type})
}

commands.wrapBulletList = pm => wrap(pm, "bullet_list")
commands.wrapOrderedList = pm => wrap(pm, "ordered_list")
commands.wrapBlockquote = pm => wrap(pm, "blockquote")

commands.endBlock = pm => {
  let head = clearSelection(pm)
  if (head.path.length > 1 && pm.doc.path(head.path).content.length == 0) {
    pm.apply({name: "lift", pos: head})
  } else {
    let end = head.path.length - 1
    let isList = head.path.length > 1 && head.path[end] == 0 &&
        pm.doc.path(head.path.slice(0, end)).type == Node.types.list_item
    pm.apply({name: "split", pos: head, depth: isList ? 2 : 1})
  }
}

function setType(pm, type, attrs) {
  let sel = pm.selection
  return pm.apply({name: "setType", pos: sel.from, end: sel.to,
                   type: type, attrs: attrs})
}

commands.makeH1 = pm => setType(pm, "heading", {level: 1})
commands.makeH2 = pm => setType(pm, "heading", {level: 2})
commands.makeH3 = pm => setType(pm, "heading", {level: 3})
commands.makeH4 = pm => setType(pm, "heading", {level: 4})
commands.makeH5 = pm => setType(pm, "heading", {level: 5})
commands.makeH6 = pm => setType(pm, "heading", {level: 6})

commands.makeParagraph = pm => setType(pm, "paragraph")
commands.makeCodeBlock = pm => setType(pm, "code_block")

function insertOpaqueBlock(pm, type, attrs) {
  let sel = pm.selection
  if (!sel.empty) return false
  let parent = pm.doc.path(sel.head.path)
  if (parent.type.type != "block") return false
  if (sel.head.offset) {
    pm.apply({name: "split", pos: sel.head})
    sel = pm.selection
  }
  pm.apply({name: "insert", pos: sel.head.shorten(), type: type, attrs: attrs})
}

commands.insertRule = pm => insertOpaqueBlock(pm, "horizontal_rule")
