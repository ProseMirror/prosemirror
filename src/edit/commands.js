import {$node, nodeTypes, Pos, style, spanAtOrBefore} from "../model"
import {joinPoint} from "../transform"

import {charCategory} from "./char"

const commands = Object.create(null)

export function registerCommand(name, func) {
  commands[name] = func
}

export function execCommand(pm, name) {
  if (pm.signalHandleable("command_" + name) !== false) return true
  let base = commands[name]
  return !!(base && base(pm) !== false)
}

function clearSel(pm) {
  let sel = pm.selection, tr = pm.tr
  if (!sel.empty) tr.delete(sel.from, sel.to)
  return tr
}

commands.insertHardBreak = pm => {
  pm.scrollIntoView()
  let tr = clearSel(pm), pos = pm.selection.from
  if (pm.doc.path(pos.path).type == nodeTypes.code_block)
    tr.insertText(pos, "\n")
  else
    tr.insert(pos, $node("hard_break"))
  pm.apply(tr)
}

commands.setStrong = pm => pm.setStyle(style.strong, true)
commands.unsetStrong = pm => pm.setStyle(style.strong, false)
commands.toggleStrong = pm => pm.setStyle(style.strong, null)

commands.setEm = pm => pm.setStyle(style.em, true)
commands.unsetEm = pm => pm.setStyle(style.em, false)
commands.toggleEm = pm => pm.setStyle(style.em, null)

commands.setCode = pm => pm.setStyle(style.code, true)
commands.unsetCode = pm => pm.setStyle(style.code, false)
commands.toggleCode = pm => pm.setStyle(style.code, null)

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
    if (iBefore) {
      tr.delete(iBefore, pos)
      let joinable = joinPoint(tr.doc, tr.map(pos).pos, 1)
      if (joinable) tr.join(joinable)
    } else if (bBefore) {
      tr.delete(bBefore, bBefore.shift(1))
    }
  } else {
    let last = pos.depth - 1
    let parent = pm.doc.path(pos.path.slice(0, last))
    let offset = pos.path[last]
    // Top of list item below other list item
    // Join with the one above
    if (parent.type == nodeTypes.list_item &&
        offset == 0 && pos.path[last - 1] > 0) {
      tr.join(joinPoint(pm.doc, pos))
    // Any other nested block, lift up
    } else {
      tr.lift(pos, pos)
    }
  }
}

function moveBackward(parent, offset, by) {
  if (by == "char") return offset - 1
  if (by == "word") {
    let {offset: nodeOffset, innerOffset} = spanAtOrBefore(parent, offset)
    let cat = null, counted = 0
    for (; nodeOffset >= 0; nodeOffset--, innerOffset = null) {
      let child = parent.content[nodeOffset], size = child.size
      if (child.type != nodeTypes.text) return cat ? offset : offset - 1

      for (let i = innerOffset == null ? size : innerOffset; i > 0; i--) {
        let nextCharCat = charCategory(child.text.charAt(i - 1))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return offset
        offset--
        counted++
      }
    }
    return offset
  }
  throw new Error("Unknown motion unit: " + by)
}

function delBackward(pm, by) {
  pm.scrollIntoView()

  let tr = pm.tr, sel = pm.selection, from = sel.from
  if (!sel.empty)
    tr.delete(from, sel.to)
  else if (from.offset == 0)
    delBlockBackward(pm, tr, from)
  else
    tr.delete(new Pos(from.path, moveBackward(pm.doc.path(from.path), from.offset, by)), from)
  pm.apply(tr)
}

commands.delBackward = pm => delBackward(pm, "char")

commands.delWordBackward = pm => delBackward(pm, "word")

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
    if (iAfter.cmp(bAfter.shift(1)) < 0) bAfter = null
    else iAfter = null
  }

  if (iAfter) {
    tr.delete(pos, iAfter)
  } else if (bAfter) {
    tr.delete(bAfter, bAfter.shift(1))
  }
}

function moveForward(parent, offset, by) {
  if (by == "char") return offset + 1
  if (by == "word") {
    let {offset: nodeOffset, innerOffset} = spanAtOrBefore(parent, offset)
    let cat = null, counted = 0
    for (; nodeOffset < parent.content.length; nodeOffset++, innerOffset = 0) {
      let child = parent.content[nodeOffset], size = child.size
      if (child.type != nodeTypes.text) return cat ? offset : offset + 1

      for (let i = innerOffset; i < size; i++) {
        let nextCharCat = charCategory(child.text.charAt(i))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return offset
        offset++
        counted++
      }
    }
    return offset
  }
  throw new Error("Unknown motion unit: " + by)
}

function delForward(pm, by) {
  pm.scrollIntoView()
  let tr = pm.tr, sel = pm.selection, from = sel.from
  if (!sel.empty) {
    tr.delete(from, sel.to)
  } else {
    let parent = pm.doc.path(from.path)
    if (from.offset == parent.size)
      delBlockForward(pm, tr, from)
    else
      tr.delete(from, new Pos(from.path, moveForward(parent, from.offset, by)))
  }
  pm.apply(tr)
}

commands.delForward = pm => delForward(pm, "char")

commands.delWordForward = pm => delForward(pm, "word")

function scrollAnd(pm, value) {
  pm.scrollIntoView()
  return value
}

commands.undo = pm => scrollAnd(pm, pm.history.undo())
commands.redo = pm => scrollAnd(pm, pm.history.redo())

commands.join = pm => {
  let point = joinPoint(pm.doc, pm.selection.head)
  if (!point) return false
  return pm.apply(pm.tr.join(point))
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
  return pm.apply(pm.tr.wrap(sel.from, sel.to, $node(type)))
}

commands.wrapBulletList = pm => wrap(pm, "bullet_list")
commands.wrapOrderedList = pm => wrap(pm, "ordered_list")
commands.wrapBlockquote = pm => wrap(pm, "blockquote")

commands.endBlock = pm => {
  pm.scrollIntoView()
  let pos = pm.selection.from
  let tr = clearSel(pm)
  let block = pm.doc.path(pos.path)
  if (pos.depth > 1 && block.content.length == 0 &&
      tr.lift(pos).steps.length) {
    // Lift
  } else if (block.type == nodeTypes.code_block && pos.offset < block.size) {
    tr.insertText(pos, "\n")
  } else {
    let end = pos.depth - 1
    let isList = end > 0 && pos.path[end] == 0 &&
        pm.doc.path(pos.path.slice(0, end)).type == nodeTypes.list_item
    let type = pos.offset == block.size ? $node("paragraph") : null
    tr.split(pos, isList ? 2 : 1, type)
  }
  return pm.apply(tr)
}

function setType(pm, type, attrs) {
  let sel = pm.selection
  pm.scrollIntoView()
  return pm.apply(pm.tr.setBlockType(sel.from, sel.to, $node(type, attrs)))
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
  type = nodeTypes[type]
  pm.scrollIntoView()
  let pos = pm.selection.from
  let tr = clearSel(pm)
  let parent = tr.doc.path(pos.path)
  if (parent.type.type != type.type) return false
  let off = 0
  if (pos.offset) {
    tr.split(pos)
    off = 1
  }
  return pm.apply(tr.insert(pos.shorten(null, off), $node(type, attrs)))
}

commands.insertRule = pm => insertOpaqueBlock(pm, "horizontal_rule")
