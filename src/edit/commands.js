import {Node, Pos, style, inline} from "../model"

const commands = Object.create(null)

export function registerCommand(name, func) {
  commands[name] = func
}

export function execCommand(pm, name) {
  let ext = pm.input.commandExtensions[name]
  if (ext && ext.high) for (let i = 0; i < ext.high.length; i++)
    if (ext.high[i](pm) !== false) return true
  if (ext && ext.normal) for (let i = 0; i < ext.normal.length; i++)
    if (ext.normal[i](pm) !== false) return true
  let base = commands[name]
  if (base && base(pm) !== false) return true
  if (ext && ext.low) for (let i = 0; i < ext.low.length; i++)
    if (ext.low[i](pm) !== false) return true
  return false
}

function clearSel(pm) {
  let sel = pm.selection, tr = pm.tr
  if (!sel.empty) tr.delete(sel.from, sel.to)
  return tr
}

commands.insertHardBreak = pm => {
  pm.scrollIntoView()
  let tr = clearSel(pm), pos = pm.selection.from
  if (pm.doc.path(pos.path).type == Node.types.code_block)
    tr.insertText(pos, "\n")
  else
    tr.insert(pos, new Node("hard_break"))
  return pm.apply(tr)
}

commands.setStrong = pm => pm.setInlineStyle(style.strong, true)
commands.unsetStrong = pm => pm.setInlineStyle(style.strong, false)
commands.toggleStrong = pm => pm.setInlineStyle(style.strong, null)

commands.setEm = pm => pm.setInlineStyle(style.em, true)
commands.unsetEm = pm => pm.setInlineStyle(style.em, false)
commands.toggleEm = pm => pm.setInlineStyle(style.em, null)

commands.setCode = pm => pm.setInlineStyle(style.code, true)
commands.unsetCode = pm => pm.setInlineStyle(style.code, false)
commands.toggleCode = pm => pm.setInlineStyle(style.code, null)

function blockBefore(pos) {
  for (let i = pos.path.length - 1; i >= 0; i--) {
    let offset = pos.path[i] - 1
    if (offset >= 0) return new Pos(pos.path.slice(0, i), offset)
  }
}

function delBlockBackward(pm, tr, pos) {
  if (pos.depth == 1) { // Top level block, join with block above
    let iBefore = Pos.before(pm.doc, new Pos([], pos.path[0]))
    let bBefore = blockBefore(pos)
    if (iBefore && bBefore) {
      if (iBefore.cmp(bBefore) > 0) bBefore = null
      else iBefore = null
    }
    if (iBefore)
      tr.delete(iBefore, pos)
    else if (bBefore)
      tr.delete(bBefore, bBefore.shift(1))
  } else {
    let last = pos.depth - 1
    let parent = pm.doc.path(pos.path.slice(0, last))
    let offset = pos.path[last]
    let range
    // Top of list item below other list item
    // Join with the one above
    if (parent.type == Node.types.list_item &&
        offset == 0 && pos.path[last - 1] > 0)
      tr.join(pos)
    // Any other nested block, lift up
    else
      tr.lift(pos, pos)
  }
}

// FIXME maybe make deleting inside of a list join items rather than escape to top?

commands.delBackward = pm => {
  pm.scrollIntoView()

  let tr = pm.tr, sel = pm.selection, from = sel.from
  if (!sel.empty)
    tr.delete(from, sel.to)
  else if (from.offset)
    tr.delete(from.shift(-1), from)
  else
    delBlockBackward(pm, tr, from)
  return pm.apply(tr)
}

function blockAfter(doc, pos) {
  let path = pos.path
  while (path.length > 0) {
    let end = path.length - 1
    let offset = path[end] + 1
    path = path.slice(0, end)
    let node = doc.path(path)
    if (offset < node.content.length)
      return new Pos(path, offset)
  }
}

function delBlockForward(pm, tr, pos) {
  let lst = pos.depth - 1
  let iAfter = Pos.after(pm.doc, new Pos(pos.path.slice(0, lst), pos.path[lst] + 1))
  let bAfter = blockAfter(pm.doc, pos)
  if (iAfter && bAfter) {
    if (iAfter.cmp(bAfter) < 0) bAfter = null
    else iAfter = null
  }
  if (iAfter)
    tr.delete(pos, iAfter)
  else if (bAfter)
    tr.delete(bAfter, bAfter.shift(1))
}

commands.delForward = pm => {
  pm.scrollIntoView()
  let tr = pm.tr, sel = pm.selection, from = sel.from
  if (!sel.empty)
    tr.delete(from, sel.to)
  else if (from.offset < pm.doc.path(from.path).size)
    tr.delete(from, from.shift(1))
  else
    delBlockForward(pm, tr, from)
  return pm.apply(tr)
}

function scrollAnd(pm, value) {
  pm.scrollIntoView()
  return value
}

commands.undo = pm => scrollAnd(pm, pm.history.undo())
commands.redo = pm => scrollAnd(pm, pm.history.redo())

commands.join = pm => {
  return pm.apply(pm.tr.join(pm.selection.head))
}

commands.lift = pm => {
  let sel = pm.selection
  let result = pm.apply(pm.tr.lift(sel.from, sel.to))
  if (result !== false) pm.scrollIntoView()
  return result
}

function wrap(pm, type) {
  let sel = pm.selection
  pm.scrollIntoView()
  return pm.apply(pm.tr.wrap(sel.from, sel.to, new Node(type)))
}

commands.wrapBulletList = pm => wrap(pm, "bullet_list")
commands.wrapOrderedList = pm => wrap(pm, "ordered_list")
commands.wrapBlockquote = pm => wrap(pm, "blockquote")

commands.endBlock = pm => {
  pm.scrollIntoView()
  let tr = clearSel(pm)
  let head = pm.selection.head
  let block = pm.doc.path(head.path)
  if (head.depth > 1 && block.content.length == 0 &&
      tr.lift(head, head).steps.length) {
    // Lift
  } else if (block.type == Node.types.code_block && head.offset < block.size) {
    tr.insertText(head, "\n")
  } else {
    let end = head.depth - 1
    let isList = end > 0 && head.path[end] == 0 &&
        pm.doc.path(head.path.slice(0, end)).type == Node.types.list_item
    let type = head.offset == block.size ? new Node("paragraph") : null
    tr.split(head, isList ? 2 : 1, type)
  }
  return pm.apply(tr)
}

function setType(pm, type, attrs) {
  let sel = pm.selection
  pm.scrollIntoView()
  return pm.apply(pm.tr.setBlockType(sel.from, sel.to, new Node(type, null, attrs)))
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
  type = Node.types[type]
  pm.scrollIntoView()
  let sel = pm.selection
  if (!sel.empty) return false
  let parent = pm.doc.path(sel.head.path)
  if (parent.type.type != type.type) return false
  let tr = pm.tr, off = 0
  if (sel.head.offset) {
    tr.split(sel.head)
    off = 1
  }
  return pm.apply(tr.insert(sel.head.shorten(null, off), new Node(type, null, attrs)))
}

commands.insertRule = pm => insertOpaqueBlock(pm, "horizontal_rule")
