import {HardBreak, BulletList, OrderedList, BlockQuote, Heading, Paragraph, CodeBlock, HorizontalRule,
        StrongStyle, EmStyle, CodeStyle, LinkStyle, Image,
        Pos, spanAtOrBefore, containsStyle, rangeHasStyle, alreadyHasBlockType} from "../model"
import {joinPoint, canLift} from "../transform"

import {charCategory, isExtendingChar} from "./char"

const globalCommands = Object.create(null)

export function defineCommand(name, cmd) {
  globalCommands[name] = cmd instanceof Command ? cmd : new Command(name, cmd)
}

export function attachCommand(typeCtor, name, create) {
  typeCtor.register("commands", type => new Command(name, create(type)))
}

export class Command {
  constructor(name, options) {
    this.name = name
    this.label = options.label || name
    this._exec = options.exec
    this.params = options.params || []
    this.select = options.select || (() => true)
    this.active = options.active || (() => false)
    this.menuGroup = options.menuGroup
    this.display = options.display
  }

  exec(pm, params) {
    if (!this.params.length) return this._exec(pm)
    if (params) return this._exec(pm, ...params)
    // FIXME make readParams a thing or remove reference to it
    pm.mod.readParams.read(this, (...params) => this._exec(pm, ...params))
  }
}

export function execCommand(pm, name) {
  // FIXME replace this mechanism with ranked bindings
  if (pm.signalHandleable("command_" + name) !== false) return true
  let base = pm.commands[name]
  return !!(base && base.exec(pm) !== false)
}

export function initCommands(schema) {
  let result = Object.create(null)
  for (let cmd in globalCommands) result[cmd] = globalCommands[cmd]
  for (let name in schema.styles) {
    let style = schema.styles[name], cmds = style.commands
    if (cmds) cmds.forEach(ctor => { let cmd = ctor(style); result[cmd.name] = cmd })
  }
  for (let name in schema.nodes) {
    let node = schema.nodes[name], cmds = node.commands
    if (cmds) cmds.forEach(ctor => { let cmd = ctor(node); result[cmd.name] = cmd })
  }
  return result
}

function clearSel(pm) {
  let sel = pm.selection, tr = pm.tr
  if (!sel.empty) tr.delete(sel.from, sel.to)
  return tr
}

attachCommand(HardBreak, "insertHardBreak", type => ({
  label: "Insert hard break",
  exec(pm) {
    pm.scrollIntoView()
    let tr = clearSel(pm), pos = pm.selection.from
    if (pm.doc.path(pos.path).type == pm.schema.nodes.code_block)
      tr.insertText(pos, "\n")
    else
      tr.insert(pos, pm.schema.node(type))
    pm.apply(tr)
  }
}))

function inlineActive(pm, type) {
  let sel = pm.selection
  if (sel.empty)
    return containsStyle(pm.activeStyles(), type)
  else
    return rangeHasStyle(pm.doc, sel.from, sel.to, type)
}

function generateStyleCommands(type, name, labelName) {
  if (!labelName) labelName = name
  let cap = name.charAt(0).toUpperCase() + name.slice(1)
  attachCommand(type, "set" + cap, type => ({
    label: "Set " + labelName,
    exec(pm) { pm.setStyle(type.create(), true) },
    select(pm) { return inlineActive(pm, type) }
  }))
  attachCommand(type, "unset" + cap, type => ({
    label: "Remove " + labelName,
    exec(pm) { pm.setStyle(type.create(), false) }
  }))
  attachCommand(type, name, type => ({
    label: "Toggle " + labelName,
    exec(pm) { pm.setStyle(type.create(), null) },
    active(pm) { return inlineActive(pm, type) },
    menuGroup: "inline"
  }))
}

generateStyleCommands(StrongStyle, "strong")
generateStyleCommands(EmStyle, "em", "emphasis")
generateStyleCommands(CodeStyle, "code")

attachCommand(LinkStyle, "unlink", type => ({
  label: "Unlink",
  exec(pm) { pm.setStyle(type, false) },
  select(pm) { return inlineActive(pm, type) }
}))
attachCommand(LinkStyle, "link", type => ({
  label: "Add link",
  exec(pm, href, title) { pm.setStyle(type.create({href, title}), true) },
  params: [
    {name: "Target", type: "text"},
    {name: "Title", type: "text", default: ""}
  ],
  menuGroup: "inline"
}))

attachCommand(Image, "insertImage", type => ({
  label: "Insert image",
  exec(pm, src, alt, title) {
    let sel = pm.selection, tr = pm.tr
    tr.delete(sel.from, sel.to)
    return pm.apply(tr.insertInline(sel.from, type.create({src, title, alt})))
  },
  params: [
    {name: "Image URL", type: "text"},
    {name: "Description / alternative text", type: "text", default: ""},
    {name: "Title", type: "text", default: ""}
  ],
  menuGroup: "inline"
}))

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
    if (parent.type == pm.schema.nodes.list_item &&
        offset == 0 && pos.path[last - 1] > 0) {
      tr.join(joinPoint(pm.doc, pos))
    // Any other nested block, lift up
    } else {
      tr.lift(pos, pos)
    }
  }
}

/**
 * Get an offset moving backward from a current offset inside a node.
 *
 * @param  {Object} parent The parent node.
 * @param  {int}    offset Offset to move from inside the node.
 * @param  {string} by     Size to delete by. Either "char" or "word".
 * @return {[type]}        [description]
 */
function moveBackward(parent, offset, by) {
  if (by != "char" && by != "word")
    throw new Error("Unknown motion unit: " + by)

  let {offset: nodeOffset, innerOffset} = spanAtOrBefore(parent, offset)
  let cat = null, counted = 0
  for (; nodeOffset >= 0; nodeOffset--, innerOffset = null) {
    let child = parent.child(nodeOffset), size = child.offset
    if (!child.isText) return cat ? offset : offset - 1

    if (by == "char") {
      for (let i = innerOffset == null ? size : innerOffset; i > 0; i--) {
        if (!isExtendingChar(child.text.charAt(i - 1)))
          return offset - 1
        offset--
      }
    } else if (by == "word") {
      // Work from the current position backwards through text of a singular
      // character category (e.g. "cat" of "#!*") until reaching a character in a
      // different category (i.e. the end of the word).
      for (let i = innerOffset == null ? size : innerOffset; i > 0; i--) {
        let nextCharCat = charCategory(child.text.charAt(i - 1))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return offset
        offset--
        counted++
      }
    }
  }
  return offset
}

/**
 * Deletes, in order of preference:
 *  - the current selection, if a selection is active
 *  - the block break if the cursor is at the beginning of a block,
 *    and a previous adjacent block exists
 *  - the preceding character
 *
 * @param  {ProseMirror} pm A ProseMirror editor instance.
 * @param  {string}      by Size to delete by. Either "char" or "word".
 */
function delBackward(pm, by) {
  pm.scrollIntoView()

  let tr = pm.tr, sel = pm.selection, from = sel.from
  if (!sel.empty)
    tr.delete(from, sel.to)
  else if (from.offset == 0)
    delBlockBackward(pm, tr, from)
  else
    tr.delete(new Pos(from.path, moveBackward(pm.doc.path(from.path), from.offset, by)), from)
  return pm.apply(tr)
}

defineCommand("delBackward", {
  label: "Delete before cursor",
  exec(pm) { return delBackward(pm, "char") }
})

defineCommand("delWordBackward", {
  label: "Delete word before cursor",
  exec(pm) { return delBackward(pm, "word") }
})

function blockAfter(doc, pos) {
  let path = pos.path
  while (path.length > 0) {
    let end = path.length - 1
    let offset = path[end] + 1
    path = path.slice(0, end)
    let node = doc.path(path)
    if (offset < node.length)
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
  if (by != "char" && by != "word")
    throw new Error("Unknown motion unit: " + by)

  let {offset: nodeOffset, innerOffset} = spanAtOrBefore(parent, offset)
  let cat = null, counted = 0
  for (; nodeOffset < parent.length; nodeOffset++, innerOffset = 0) {
    let child = parent.child(nodeOffset), size = child.offset
    if (!child.isText) return cat ? offset : offset + 1

    if (by == "char") {
      for (let i = innerOffset; i < size; i++) {
        if (!isExtendingChar(child.text.charAt(i + 1)))
          return offset + 1
        offset++
      }
    } else if (by == "word") {
      for (let i = innerOffset; i < size; i++) {
        let nextCharCat = charCategory(child.text.charAt(i))
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat
        else if (cat != nextCharCat) return offset
        offset++
        counted++
      }
    }
  }
  return offset
}

function delForward(pm, by) {
  pm.scrollIntoView()
  let tr = pm.tr, sel = pm.selection, from = sel.from
  if (!sel.empty) {
    tr.delete(from, sel.to)
  } else {
    let parent = pm.doc.path(from.path)
    if (from.offset == parent.maxOffset)
      delBlockForward(pm, tr, from)
    else
      tr.delete(from, new Pos(from.path, moveForward(parent, from.offset, by)))
  }
  return pm.apply(tr)
}

defineCommand("delForward", {
  label: "Delete after cursor",
  exec(pm) { return delForward(pm, "char") }
})

defineCommand("delWordForward", {
  label: "Delete word after cursor",
  exec(pm) { return delForward(pm, "word") }
})

defineCommand("join", {
  label: "Join with above block",
  exec(pm) {
    let point = joinPoint(pm.doc, pm.selection.head)
    if (!point) return false
    return pm.apply(pm.tr.join(point))
  },
  select(pm) { return joinPoint(pm.doc, pm.selection.head) },
  menuGroup: "block"
})

defineCommand("lift", {
  label: "Lift out of enclosing block",
  exec(pm) {
    let sel = pm.selection
    let result = pm.apply(pm.tr.lift(sel.from, sel.to))
    if (result !== false) pm.scrollIntoView()
    return result
  },
  select(pm) {
    let sel = pm.selection
    return canLift(pm.doc, sel.from, sel.to)
  },
  menuGroup: "block"
})

function wrapCommand(type, name, labelName) {
  attachCommand(type, "wrap" + name, type => ({
    label: "Wrap in " + labelName,
    exec(pm) {
      let sel = pm.selection
      pm.scrollIntoView()
      return pm.apply(pm.tr.wrap(sel.from, sel.to, type.create()))
    },
    menuGroup: "block"
  }))
}

wrapCommand(BulletList, "BulletList", "bullet list")
wrapCommand(OrderedList, "OrderedList", "ordered list")
wrapCommand(BlockQuote, "BlockQuote", "block quote")

defineCommand("endBlock", {
  label: "End or split the current block",
  exec(pm) { // FIXME remove node-specific logic (specialize?)
    pm.scrollIntoView()
    let pos = pm.selection.from
    let tr = clearSel(pm)
    let block = pm.doc.path(pos.path)
    if (pos.depth > 1 && block.length == 0 &&
        tr.lift(pos).steps.length) {
      // Lift
    } else if (block.type == pm.schema.nodes.code_block && pos.offset < block.maxOffset) {
      tr.insertText(pos, "\n")
    } else {
      let end = pos.depth - 1
      let isList = end > 0 && pos.path[end] == 0 &&
          pm.doc.path(pos.path.slice(0, end)).type == pm.schema.nodes.list_item
      let type = pos.offset == block.maxOffset ? pm.schema.node("paragraph") : null
      tr.split(pos, isList ? 2 : 1, type)
    }
    return pm.apply(tr)
  }
})

function setType(pm, type, attrs) {
  let sel = pm.selection
  pm.scrollIntoView()
  return pm.apply(pm.tr.setBlockType(sel.from, sel.to, pm.schema.node(type, attrs)))
}

function blockTypeCommand(type, name, labelName, attrs) {
  if (!attrs) attrs = {}
  attachCommand(type, name, type => ({
    label: "Change to " + labelName,
    exec(pm) { return setType(pm, type, attrs) },
    select(pm) {
      let sel = pm.selection
      return !alreadyHasBlockType(pm.doc, sel.from, sel.to, type, attrs)
    }
  }))
}

blockTypeCommand(Heading, "makeH1", "heading 1", {level: 1})
blockTypeCommand(Heading, "makeH2", "heading 2", {level: 2})
blockTypeCommand(Heading, "makeH3", "heading 3", {level: 3})
blockTypeCommand(Heading, "makeH4", "heading 4", {level: 4})
blockTypeCommand(Heading, "makeH5", "heading 5", {level: 5})
blockTypeCommand(Heading, "makeH6", "heading 6", {level: 6})

blockTypeCommand(Paragraph, "makeParagraph", "paragraph")
blockTypeCommand(CodeBlock, "makeCodeBlock", "code block")

function insertOpaqueBlock(pm, type, attrs) {
  pm.scrollIntoView()
  let pos = pm.selection.from
  let tr = clearSel(pm)
  let parent = tr.doc.path(pos.shorten().path)
  if (!parent.type.canContain(type)) return false
  let off = 0
  if (pos.offset) {
    tr.split(pos)
    off = 1
  }
  return pm.apply(tr.insert(pos.shorten(null, off), pm.schema.node(type, attrs)))
}

attachCommand(HorizontalRule, "insertHorizontalRule", type => ({
  label: "Insert horizontal rule",
  exec(pm) { return insertOpaqueBlock(pm, type) }
}))

defineCommand("undo", {
  label: "Undo last change",
  exec(pm) { pm.scrollIntoView(); return pm.history.undo() },
  select(pm) { return pm.history.canUndo() },
  menuGroup: "history"
})

defineCommand("redo", {
  label: "Redo last undone change",
  exec(pm) { pm.scrollIntoView(); return pm.history.redo() },
  select(pm) { return pm.history.canRedo() },
  menuGroup: "history"
})

// FIXME does this belong here?

defineCommand("blockType", {
  label: "Change block type",
  exec(pm) {
    // FIXME
  },
  params: [
    {name: "Type", type: "select", options: listBlockTypes}
  ],
  display: "select",
//  menuGroup: "block"
})

function listBlockTypes(pm) {
  let found = []
  // FIXME
  return found
}

/* FIXME old code to be rewritten

const blockTypes = [
  {name: "Normal", type: "paragraph"},
  {name: "Code", type: "code_block"}
]
for (let i = 1; i <= 6; i++)
  blockTypes.push({name: "Head " + i, type: "heading", attrs: {level: i}})
function getBlockType(block) {
  for (let i = 0; i < blockTypes.length; i++)
    if (blockTypes[i].type == block.type.name &&
        (block.attrs.level == null || block.attrs.level == blockTypes[i].attrs.level))
      return blockTypes[i]
}

class BlockTypeItem extends MenuItem {
  render(menu) {
    let sel = menu.pm.selection, type
    if (Pos.samePath(sel.head.path, sel.anchor.path)) type = getBlockType(menu.pm.doc.path(sel.head.path))
    let dom = elt("div", {class: "ProseMirror-blocktype", title: "Paragraph type"},
                  type ? type.name : "Type...")
    dom.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      showBlockTypeMenu(menu.pm, dom)
    })
    return dom
  }
}

function showBlockTypeMenu(pm, dom) {
  let menu = elt("div", {class: "ProseMirror-blocktype-menu"},
                 blockTypes.map(t => {
                   let dom = elt("div", null, t.name)
                   dom.addEventListener("mousedown", e => {
                     e.preventDefault()
                     let sel = pm.selection
                     pm.apply(pm.tr.setBlockType(sel.from, sel.to, pm.schema.node(t.type, t.attrs)))
                     finish()
                   })
                   return dom
                 }))
  let pos = dom.getBoundingClientRect(), box = pm.wrapper.getBoundingClientRect()
  menu.style.left = (pos.left - box.left - 2) + "px"
  menu.style.top = (pos.top - box.top - 2) + "px"

  let done = false
  function finish() {
    if (done) return
    done = true
    document.body.removeEventListener("mousedown", finish)
    document.body.removeEventListener("keydown", finish)
    pm.wrapper.removeChild(menu)
  }
  document.body.addEventListener("mousedown", finish)
  document.body.addEventListener("keydown", finish)
  pm.wrapper.appendChild(menu)
}
*/
