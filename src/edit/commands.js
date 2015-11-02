import {HardBreak, BulletList, OrderedList, BlockQuote, Heading, Paragraph, CodeBlock, HorizontalRule,
        StrongStyle, EmStyle, CodeStyle, LinkStyle, Image, NodeType, StyleType,
        Pos, spanAtOrBefore, containsStyle, rangeHasStyle} from "../model"
import {joinPoint, canLift, alreadyHasBlockType} from "../transform"
import {browser} from "../dom"
import sortedInsert from "../util/sortedinsert"

import {charCategory, isExtendingChar} from "./char"
import {Keymap} from "./keys"

const globalCommands = Object.create(null)
const paramHandlers = Object.create(null)

export function defineCommand(name, cmd) {
  globalCommands[name] = cmd instanceof Command ? cmd : new Command(name, cmd)
}

NodeType.attachCommand = StyleType.attachCommand = function(name, create) {
  this.register("commands", {name, create})
}

export function defineParamHandler(name, handler) {
  paramHandlers[name] = handler
}

function getParamHandler(pm) {
  let option = pm.options.commandParamHandler
  if (option && paramHandlers[option]) return paramHandlers[option]
}

export class Command {
  constructor(name, options) {
    this.name = name
    this.label = options.label || name
    this.run = options.run
    this.params = options.params || []
    this.select = options.select || (() => true)
    this.active = options.active || (() => false)
    this.info = options.info || {}
    this.display = options.display || "icon"
  }

  exec(pm, params) {
    if (!this.params.length) return this.run(pm)
    if (params) return this.run(pm, ...params)
    let handler = getParamHandler(pm)
    if (handler) handler(pm, this, params => {
      if (params) this.run(pm, ...params)
    })
    else return false
  }
}

export function initCommands(schema) {
  let result = Object.create(null)
  for (let cmd in globalCommands) result[cmd] = globalCommands[cmd]
  function fromTypes(types) {
    for (let name in types) {
      let type = types[name], cmds = type.commands
      if (cmds) cmds.forEach(({name, create}) => {
        result[name] = new Command(name, create(type))
      })
    }
  }
  fromTypes(schema.nodes)
  fromTypes(schema.styles)
  return result
}

export function defaultKeymap(pm) {
  let bindings = {}
  function add(command, key) {
    if (Array.isArray(key)) {
      for (let i = 0; i < key.length; i++) add(command, key[i])
    } else if (key) {
      let [_, name, rank = 50] = /^(.+?)(?:\((\d+)\))?$/.exec(key)
      sortedInsert(bindings[name] || (bindings[name] = []), {command, rank},
                   (a, b) => a.rank - b.rank)
    }
  }
  for (let name in pm.commands) {
    let cmd = pm.commands[name]
    add(name, cmd.info.key)
    add(name, browser.mac ? cmd.info.macKey : cmd.info.pcKey)
  }

  for (let key in bindings)
    bindings[key] = bindings[key].map(b => b.command)
  return new Keymap(bindings)
}

function clearSel(pm) {
  let sel = pm.selection, tr = pm.tr
  if (!sel.empty) tr.delete(sel.from, sel.to)
  return tr
}

const andScroll = {scrollIntoView: true}

HardBreak.attachCommand("insertHardBreak", type => ({
  label: "Insert hard break",
  run(pm) {
    let tr = clearSel(pm), pos = pm.selection.from
    if (pm.doc.path(pos.path).type.isCode)
      tr.insertText(pos, "\n")
    else
      tr.insert(pos, pm.schema.node(type))
    pm.apply(tr, andScroll)
  },
  info: {key: ["Mod-Enter", "Shift-Enter"]}
}))

function inlineStyleActive(pm, type) {
  let sel = pm.selection
  if (sel.empty)
    return containsStyle(pm.activeStyles(), type)
  else
    return rangeHasStyle(pm.doc, sel.from, sel.to, type)
}

function canAddInline(pm, type) {
  let {from, to, empty} = pm.selection
  if (empty)
    return !containsStyle(pm.activeStyles(), type) && pm.doc.path(from.path).type.canContainStyle(type)
  let can = false
  pm.doc.nodesBetween(from, to, node => {
    if (can || node.isTextblock && !node.type.canContainStyle(type)) return false
    if (node.isInline && !containsStyle(node.styles, type)) can = true
  })
  return can
}

function inlineStyleApplies(pm, type) {
  let {from, to} = pm.selection
  let relevant = false
  pm.doc.nodesBetween(from, to, node => {
    if (node.isTextblock) {
      if (node.type.canContainStyle(type)) relevant = true
      return false
    }
  })
  return relevant
}

function generateStyleCommands(type, name, labelName, info) {
  if (!labelName) labelName = name
  let cap = name.charAt(0).toUpperCase() + name.slice(1)
  type.attachCommand("set" + cap, type => ({
    label: "Set " + labelName,
    run(pm) { pm.setStyle(type.create(), true) },
    select(pm) { return canAddInline(pm, type) }
  }))
  type.attachCommand("unset" + cap, type => ({
    label: "Remove " + labelName,
    run(pm) { pm.setStyle(type.create(), false) },
    select(pm) { return inlineStyleActive(pm, type) }
  }))
  type.attachCommand(name, type => ({
    label: "Toggle " + labelName,
    run(pm) { pm.setStyle(type.create(), null) },
    active(pm) { return inlineStyleActive(pm, type) },
    select(pm) { return inlineStyleApplies(pm, type) },
    info
  }))
}

generateStyleCommands(StrongStyle, "strong", null, {
  menuGroup: "inline",
  menuRank: 20,
  key: "Mod-B"
})

generateStyleCommands(EmStyle, "em", "emphasis", {
  menuGroup: "inline",
  menuRank: 21,
  key: "Mod-I"
})

generateStyleCommands(CodeStyle, "code", null, {
  menuGroup: "inline",
  menuRank: 22,
  key: "Mod-`"
})

LinkStyle.attachCommand("unlink", type => ({
  label: "Unlink",
  run(pm) { pm.setStyle(type, false) },
  select(pm) { return inlineStyleActive(pm, type) },
  active() { return true },
  info: {menuGroup: "inline", menuRank: 30}
}))
LinkStyle.attachCommand("link", type => ({
  label: "Add link",
  run(pm, href, title) { pm.setStyle(type.create({href, title}), true) },
  params: [
    {name: "Target", type: "text"},
    {name: "Title", type: "text", default: ""}
  ],
  select(pm) { return inlineStyleApplies(pm, type) && !inlineStyleActive(pm, type) },
  info: {menuGroup: "inline", menuRank: 30}
}))

Image.attachCommand("insertImage", type => ({
  label: "Insert image",
  run(pm, src, alt, title) {
    let sel = pm.selection, tr = pm.tr
    tr.delete(sel.from, sel.to)
    return pm.apply(tr.insertInline(sel.from, type.create({src, title, alt})))
  },
  params: [
    {name: "Image URL", type: "text"},
    {name: "Description / alternative text", type: "text", default: ""},
    {name: "Title", type: "text", default: ""}
  ],
  select(pm) {
    return pm.doc.path(pm.selection.from.path).type.canContainType(type)
  },
  info: {menuGroup: "inline", menuRank: 40}
}))

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

defineCommand("deleteSelection", {
  label: "Delete the selection",
  run(pm) {
    let {from, to, empty} = pm.selection
    if (empty) return false
    return pm.apply(pm.tr.delete(from, to), andScroll)
  },
  info: {key: ["Backspace(10)", "Delete(10)", "Mod-Backspace(10)", "Mod-Delete(10)"],
         macKey: ["Ctrl-H(10)", "Alt-Backspace(10)", "Ctrl-D(10)", "Ctrl-Alt-Backspace(10)", "Alt-Delete(10)", "Alt-D(10)"]}
})

function deleteBarrier(pm, cut) {
  let around = pm.doc.path(cut.path), target = around.child(cut.offset - 1)
  for (let pos = cut, inner;; pos = inner) {
    let parent = pm.doc.path(pos.path)
    if (pos.offset >= parent.length) return false
    let after = parent.child(pos.offset), wrappers, conn
    inner = new Pos(pos.path.concat(pos.offset), 0)
    if (target.type.canContainChildren(after))
      wrappers = [after]
    else if (conn = target.type.findConnection(after.type))
      wrappers = [target, ...conn.map(t => t.create()), after]
    else
      continue

    let tr = pm.tr, diff = pos.depth - cut.depth
    if (diff) tr.splitIfNeeded(pos.move(1), diff)
    if (diff || wrappers.length > 1)
      tr.step("ancestor", inner, new Pos(inner.path, after.maxOffset), null, {depth: diff + 1, wrappers})
    tr.join(cut)
    if (wrappers.length > 1 && around.length > cut.offset + 1 &&
        tr.doc.path(cut.path).length == around.length - 1 &&
        around.child(cut.offset + 1).sameMarkup(target))
      tr.join(cut)
    return pm.apply(tr, andScroll)
  }
}

defineCommand("joinBackward", {
  label: "Join with the block above",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset > 0) return false

    // Find the node before this one
    let before, cut
    for (let i = head.path.length - 1; !before && i >= 0; i--) if (head.path[i] > 0) {
      cut = head.shorten(i)
      before = pm.doc.path(cut.path).child(cut.offset - 1)
    }

    // If there is no node before this, try to lift
    if (!before)
      return pm.apply(pm.tr.lift(head), andScroll)

    // If the node doesn't allow children, delete it
    if (before.type.contains == null)
      return pm.apply(pm.tr.delete(cut.move(-1), cut), andScroll)

    // Apply the joining algorithm
    if (deleteBarrier(pm, cut) !== false)
      return

    // As fallback, try a lift
    return pm.apply(pm.tr.lift(head), andScroll)
  },
  info: {key: ["Backspace(30)", "Mod-Backspace(30)"]}
})

defineCommand("deleteCharBefore", {
  label: "Delete a character before the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "char")
    return pm.apply(pm.tr.delete(new Pos(head.path, from), head), andScroll)
  },
  info: {key: "Backspace(60)", macKey: "Ctrl-H(40)"}
})

defineCommand("deleteWordBefore", {
  label: "Delete the word before the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "word")
    return pm.apply(pm.tr.delete(new Pos(head.path, from), head), andScroll)
  },
  info: {key: "Mod-Backspace(40)", macKey: "Alt-Backspace(40)"}
})

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

defineCommand("joinForward", {
  label: "Join with the block below",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset < pm.doc.path(head.path).maxOffset) return false

    // Find the node after this one
    let after, cut
    for (let i = head.path.length - 1; !after && i >= 0; i--) {
      cut = head.shorten(i, 1)
      let parent = pm.doc.path(cut.path)
      if (cut.offset < parent.length)
        after = parent.child(cut.offset)
    }

    // If there is no node after this, there's nothing to do
    if (!after) return false

    // If the node doesn't allow children, delete it
    if (after.type.contains == null)
      return pm.apply(pm.tr.delete(cut, cut.move(1)), andScroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  info: {key: ["Delete(30)", "Mod-Delete(30)"]}
})

defineCommand("deleteCharAfter", {
  label: "Delete a character after the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == 0) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "char")
    return pm.apply(pm.tr.delete(head, new Pos(head.path, to)), andScroll)
  },
  info: {key: "Delete(60)", macKey: "Ctrl-D(60)"}
})

defineCommand("deleteWordAfter", {
  label: "Delete a character after the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == 0) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "word")
    return pm.apply(pm.tr.delete(head, new Pos(head.path, to)), andScroll)
  },
  info: {key: "Mod-Delete(40)", macKey: ["Ctrl-Alt-Backspace(40)", "Alt-Delete(40)", "Alt-D(40)"]}
})

defineCommand("join", {
  label: "Join with above block",
  run(pm) {
    let point = joinPoint(pm.doc, pm.selection.head)
    if (!point) return false
    return pm.apply(pm.tr.join(point))
  },
  select(pm) { return joinPoint(pm.doc, pm.selection.head) },
  info: {
    menuGroup: "block", menuRank: 80,
    key: "Alt-Up"
  }
})

defineCommand("lift", {
  label: "Lift out of enclosing block",
  run(pm) {
    let sel = pm.selection
    return pm.apply(pm.tr.lift(sel.from, sel.to), andScroll)
  },
  select(pm) {
    let sel = pm.selection
    return canLift(pm.doc, sel.from, sel.to)
  },
  info: {
    menuGroup: "block", menuRank: 75,
    key: "Alt-Left"
  }
})

// FIXME add select method
function wrapCommand(type, name, labelName, info) {
  type.attachCommand("wrap" + name, type => ({
    label: "Wrap in " + labelName,
    run(pm) {
      let sel = pm.selection
      return pm.apply(pm.tr.wrap(sel.from, sel.to, type.create()), andScroll)
    },
    info
  }))
}

wrapCommand(BulletList, "BulletList", "bullet list", {
  menuGroup: "block",
  menuRank: 40,
  key: ["Alt-Right '*'", "Alt-Right '-'"]
})

wrapCommand(OrderedList, "OrderedList", "ordered list", {
  menuGroup: "block",
  menuRank: 41,
  key: "Alt-Right '1'"
})

wrapCommand(BlockQuote, "BlockQuote", "block quote", {
  menuGroup: "block",
  menuRank: 45,
  key: ["Alt-Right '>'", "Alt-Right '\"'"]
})

defineCommand("newlineInCode", {
  label: "Insert newline",
  run(pm) {
    let {from, to} = pm.selection, block
    if (Pos.samePath(from.path, to.path) &&
        (block = pm.doc.path(from.path)).type.isCode &&
        to.offset < block.maxOffset) {
      return pm.apply(clearSel(pm).insertText(from, "\n"), andScroll)
    }
    return false
  },
  info: {key: "Enter(10)"}
})

defineCommand("liftEmptyBlock", {
  label: "Move current block up",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset > 0) return false
    let block = pm.doc.path(head.path)
    if (block.length != 0) return false
    if (head.path[head.path.length - 1] > 0 &&
        pm.apply(pm.tr.split(head.shorten())) !== false)
      return
    return pm.apply(pm.tr.lift(head), andScroll)
  },
  info: {key: "Enter(30)"}
})

defineCommand("splitBlock", {
  label: "Split the current block",
  run(pm) {
    let {from, to} = pm.selection, block = pm.doc.path(to.path)
    let type = to.offset == block.maxOffset ? pm.schema.defaultTextblockType().create() : null
    return pm.apply(clearSel(pm).split(from, 1, type), andScroll)
  },
  info: {key: "Enter(60)"}
})

function setType(pm, type, attrs) {
  let sel = pm.selection
  return pm.apply(pm.tr.setBlockType(sel.from, sel.to, pm.schema.node(type, attrs)), andScroll)
}

function blockTypeCommand(type, name, labelName, attrs, key) {
  if (!attrs) attrs = {}
  type.attachCommand(name, type => ({
    label: "Change to " + labelName,
    run(pm) { return setType(pm, type, attrs) },
    select(pm) {
      let sel = pm.selection
      return !alreadyHasBlockType(pm.doc, sel.from, sel.to, type, attrs)
    },
    info: {key}
  }))
}

blockTypeCommand(Heading, "makeH1", "heading 1", {level: 1}, "Mod-H '1'")
blockTypeCommand(Heading, "makeH2", "heading 2", {level: 2}, "Mod-H '2'")
blockTypeCommand(Heading, "makeH3", "heading 3", {level: 3}, "Mod-H '3'")
blockTypeCommand(Heading, "makeH4", "heading 4", {level: 4}, "Mod-H '4'")
blockTypeCommand(Heading, "makeH5", "heading 5", {level: 5}, "Mod-H '5'")
blockTypeCommand(Heading, "makeH6", "heading 6", {level: 6}, "Mod-H '6'")

blockTypeCommand(Paragraph, "makeParagraph", "paragraph", null, "Mod-P")
blockTypeCommand(CodeBlock, "makeCodeBlock", "code block", null, "Mod-\\")

function insertOpaqueBlock(pm, type, attrs) {
  let pos = pm.selection.from
  let tr = clearSel(pm)
  let parent = tr.doc.path(pos.shorten().path)
  let node = type.create(attrs)
  if (!parent.type.canContain(node)) return false
  let off = 0
  if (pos.offset) {
    tr.split(pos)
    off = 1
  }
  return pm.apply(tr.insert(pos.shorten(null, off), node), andScroll)
}

HorizontalRule.attachCommand("insertHorizontalRule", type => ({
  label: "Insert horizontal rule",
  run(pm) { return insertOpaqueBlock(pm, type) },
  info: {key: "Mod-Space"}
}))

defineCommand("undo", {
  label: "Undo last change",
  run(pm) { pm.scrollIntoView(); return pm.history.undo() },
  select(pm) { return pm.history.canUndo() },
  info: {
    menuGroup: "history",
    menuRank: 10,
    key: "Mod-Z"
  }
})

defineCommand("redo", {
  label: "Redo last undone change",
  run(pm) { pm.scrollIntoView(); return pm.history.redo() },
  select(pm) { return pm.history.canRedo() },
  info: {
    menuGroup: "history",
    menuRank: 20,
    key: ["Mod-Y", "Shift-Mod-Z"]
  }
})

defineCommand("textblockType", {
  label: "Change block type",
  run(pm, type) {
    let sel = pm.selection
    return pm.apply(pm.tr.setBlockType(sel.from, sel.to, type))
  },
  params: [
    {name: "Type", type: "select", options: listTextblockTypes, default: currentTextblockType, defaultLabel: "Type..."}
  ],
  display: "select",
  info: {menuGroup: "block", menuRank: 10}
})

Paragraph.prototype.textblockTypes = [{label: "Normal", rank: 10}]
CodeBlock.prototype.textblockTypes = [{label: "Code", rank: 20}]
Heading.prototype.textblockTypes = [1, 2, 3, 4, 5, 6].map(n => ({label: "Head " + n, attrs: {level: n}, rank: 30 + n}))

function listTextblockTypes(pm) {
  let cached = pm.schema.cached.textblockTypes
  if (cached) return cached

  let found = []
  for (let name in pm.schema.nodes) {
    let type = pm.schema.nodes[name]
    if (!type.textblockTypes) continue
    for (let i = 0; i < type.textblockTypes.length; i++) {
      let info = type.textblockTypes[i]
      sortedInsert(found, {label: info.label, value: type.create(info.attrs), rank: info.rank},
                   (a, b) => a.rank - b.rank)
    }
  }
  return pm.schema.cached.textblockTypes = found
}

function currentTextblockType(pm) {
  let sel = pm.selection
  if (!Pos.samePath(sel.head.path, sel.anchor.path)) return null
  let types = listTextblockTypes(pm)
  let focusNode = pm.doc.path(pm.selection.head.path)
  for (let i = 0; i < types.length; i++)
    if (types[i].value.sameMarkup(focusNode)) return types[i]
}
