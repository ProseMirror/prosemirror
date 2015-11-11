import {HardBreak, BulletList, OrderedList, BlockQuote, Heading, Paragraph, CodeBlock, HorizontalRule,
        StrongStyle, EmStyle, CodeStyle, LinkStyle, Image, NodeType, StyleType,
        Pos, containsStyle, rangeHasStyle, compareMarkup} from "../model"
import {joinPoint, joinableBlocks, canLift, canWrap, alreadyHasBlockType} from "../transform"
import {browser} from "../dom"
import sortedInsert from "../util/sortedinsert"

import {charCategory, isExtendingChar} from "./char"
import {Keymap} from "./keys"
import {selectableBlockFrom, verticalMotionLeavesTextblock, setDOMSelectionToPos} from "./selection"

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

const andScroll = {scrollIntoView: true}

HardBreak.attachCommand("insertHardBreak", type => ({
  label: "Insert hard break",
  run(pm) {
    let tr = pm.tr.clearSelection(), head = tr.selHead
    if (pm.doc.path(head.path).type.isCode)
      tr.insertText(head, "\n")
    else
      tr.insert(head, pm.schema.node(type))
    tr.apply(andScroll)
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
    let tr = pm.tr.clearSelection()
    return tr.insertInline(tr.selHead, type.create({src, title, alt})).apply(andScroll)
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

  let {index, innerOffset} = parent.childBefore(offset)
  let cat = null, counted = 0
  for (; index >= 0; index--, innerOffset = null) {
    let child = parent.child(index), size = child.offset
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
    let {from, to, nodePos, node} = pm.selection
    if (node && node.isBlock && pm.doc.path(nodePos.path).length > 1 &&
        (Pos.before(pm.doc, nodePos) || Pos.after(pm.doc, nodePos.move(1)))) {
      from = nodePos
      to = nodePos.move(1)
    }
    if (from.cmp(to) == 0) return false
    pm.tr.delete(from, to).apply()
    if (node && node.isBlock) {
      let after = selectableBlockFrom(pm.doc, nodePos, 1)
      if (!after)
        pm.setSelection(Pos.before(pm.doc, from))
      else if (pm.doc.path(after).isTextblock)
        pm.setSelection(new Pos(after, 0))
      else
        pm.setNodeSelection(new Pos(after, 0).shorten())
    }
  },
  info: {key: ["Backspace(10)", "Delete(10)", "Mod-Backspace(10)", "Mod-Delete(10)"],
         macKey: ["Ctrl-H(10)", "Alt-Backspace(10)", "Ctrl-D(10)", "Ctrl-Alt-Backspace(10)", "Alt-Delete(10)", "Alt-D(10)"]}
})

function deleteBarrier(pm, cut) {
  let around = pm.doc.path(cut.path)
  let before = around.child(cut.offset - 1), after = around.child(cut.offset)
  if (before.type.canContainChildren(after) && pm.tr.join(cut).apply(andScroll) !== false)
    return

  let conn
  if (after.isTextblock && (conn = before.type.findConnection(after.type))) {
    let tr = pm.tr, end = cut.move(1)
    tr.step("ancestor", cut, end, null, {wrappers: [before, ...conn.map(t => t.create())]})
    tr.join(end)
    tr.join(cut)
    if (tr.apply(andScroll) !== false) return
  }

  let inner = Pos.after(pm.doc, cut)
  return !inner ? false : pm.tr.lift(inner).apply(andScroll)
}

defineCommand("joinBackward", {
  label: "Join with the block above",
  run(pm) {
    let {head, cursor} = pm.selection
    if (!cursor || head.offset > 0) return false

    // Find the node before this one
    let before, cut
    for (let i = head.path.length - 1; !before && i >= 0; i--) if (head.path[i] > 0) {
      cut = head.shorten(i)
      before = pm.doc.path(cut.path).child(cut.offset - 1)
    }

    // If there is no node before this, try to lift
    if (!before)
      return pm.tr.lift(head).apply(andScroll)

    // If the node doesn't allow children, delete it
    if (before.type.contains == null)
      return pm.tr.delete(cut.move(-1), cut).apply(andScroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  info: {key: ["Backspace(30)", "Mod-Backspace(30)"]}
})

defineCommand("deleteCharBefore", {
  label: "Delete a character before the cursor",
  run(pm) {
    let {head, cursor} = pm.selection
    if (!cursor || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "char")
    return pm.tr.delete(new Pos(head.path, from), head).apply(andScroll)
  },
  info: {key: "Backspace(60)", macKey: "Ctrl-H(40)"}
})

defineCommand("deleteWordBefore", {
  label: "Delete the word before the cursor",
  run(pm) {
    let {head, cursor} = pm.selection
    if (!cursor || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "word")
    return pm.tr.delete(new Pos(head.path, from), head).apply(andScroll)
  },
  info: {key: "Mod-Backspace(40)", macKey: "Alt-Backspace(40)"}
})

function moveForward(parent, offset, by) {
  if (by != "char" && by != "word")
    throw new Error("Unknown motion unit: " + by)

  let {index, innerOffset} = parent.childAfter(offset)
  let cat = null, counted = 0
  for (; index < parent.length; index++, innerOffset = 0) {
    let child = parent.child(index), size = child.offset
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
    let {head, cursor} = pm.selection
    if (!cursor || head.offset < pm.doc.path(head.path).maxOffset) return false

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
      return pm.tr.delete(cut, cut.move(1)).apply(andScroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  info: {key: ["Delete(30)", "Mod-Delete(30)"]}
})

defineCommand("deleteCharAfter", {
  label: "Delete a character after the cursor",
  run(pm) {
    let {head, cursor} = pm.selection
    if (!cursor || head.offset == pm.doc.path(head.path).maxOffset) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "char")
    return pm.tr.delete(head, new Pos(head.path, to)).apply(andScroll)
  },
  info: {key: "Delete(60)", macKey: "Ctrl-D(60)"}
})

defineCommand("deleteWordAfter", {
  label: "Delete a character after the cursor",
  run(pm) {
    let {head, cursor} = pm.selection
    if (!cursor || head.offset == pm.doc.path(head.path).maxOffset) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "word")
    return pm.tr.delete(head, new Pos(head.path, to)).apply(andScroll)
  },
  info: {key: "Mod-Delete(40)", macKey: ["Ctrl-Alt-Backspace(40)", "Alt-Delete(40)", "Alt-D(40)"]}
})

function joinPointAbove(pm) {
  let {nodePos, from} = pm.selection
  if (nodePos) return joinableBlocks(pm.doc, nodePos) ? nodePos : null
  else return joinPoint(pm.doc, from, -1)
}

defineCommand("joinUp", {
  label: "Join with above block",
  run(pm) {
    let nodePos = pm.selection.nodePos
    let point = joinPointAbove(pm)
    if (!point) return false
    pm.tr.join(point).apply()
    if (nodePos) pm.setNodeSelection(nodePos.move(-1))
  },
  select(pm) { return joinPointAbove(pm) },
  info: {
    menuGroup: "block", menuRank: 80,
    key: "Alt-Up"
  }
})

function joinPointBelow(pm) {
  let {nodePos, to} = pm.selection
  if (nodePos) return joinableBlocks(pm.doc, nodePos.move(1)) ? nodePos.move(1) : null
  else return joinPoint(pm.doc, to, 1)
}

defineCommand("joinDown", {
  label: "Join with below block",
  run(pm) {
    let nodePos = pm.selection.nodePos
    let point = joinPointBelow(pm)
    if (!point) return false
    pm.tr.join(point).apply()
    if (nodePos) pm.setNodeSelection(nodePos)
  },
  select(pm) { return joinPointBelow(pm) },
  info: {key: "Alt-Down"}
})

function blockRange(pm) {
  let {nodePos, from, to} = pm.selection
  return nodePos ? {from: nodePos, to: nodePos.move(1)} : {from, to}
}

defineCommand("lift", {
  label: "Lift out of enclosing block",
  run(pm) {
    let {from, to} = blockRange(pm)
    return pm.tr.lift(from, to).apply(andScroll)
  },
  select(pm) {
    let {from, to} = blockRange(pm)
    return canLift(pm.doc, from, to)
  },
  info: {
    menuGroup: "block", menuRank: 75,
    key: "Alt-Left"
  }
})

function wrapCommand(type, name, labelName, info) {
  type.attachCommand("wrap" + name, type => ({
    label: "Wrap in " + labelName,
    run(pm) {
      let {from, to} = blockRange(pm)
      return pm.tr.wrap(from, to, type.create()).apply(andScroll)
    },
    select(pm) {
      let {from, to} = blockRange(pm)
      return canWrap(pm.doc, from, to, type.create())
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
    let {from, to, nodePos} = pm.selection, block
    if (!nodePos && Pos.samePath(from.path, to.path) &&
        (block = pm.doc.path(from.path)).type.isCode &&
        to.offset < block.maxOffset) {
      let tr = pm.tr.clearSelection()
      return tr.insertText(tr.selHead, "\n").apply(andScroll)
    }
    return false
  },
  info: {key: "Enter(10)"}
})

defineCommand("liftEmptyBlock", {
  label: "Move current block up",
  run(pm) {
    let {head, cursor} = pm.selection
    if (!cursor || head.offset > 0) return false
    if (head.path[head.path.length - 1] > 0 &&
        pm.tr.split(head.shorten()).apply() !== false)
      return
    return pm.tr.lift(head).apply(andScroll)
  },
  info: {key: "Enter(30)"}
})

defineCommand("splitBlock", {
  label: "Split the current block",
  run(pm) {
    let {from, to, node} = pm.selection, block = pm.doc.path(to.path)
    if (node && node.isBlock) return false
    let type = to.offset == block.maxOffset ? pm.schema.defaultTextblockType().create() : null
    return pm.tr.clearSelection(pm).split(from, 1, type).apply(andScroll)
  },
  info: {key: "Enter(60)"}
})

function setType(pm, type, attrs) {
  let {from, to} = pm.selection
  return pm.tr.setBlockType(from, to, pm.schema.node(type, attrs)).apply(andScroll)
}

function blockTypeCommand(type, name, labelName, attrs, key) {
  if (!attrs) attrs = {}
  type.attachCommand(name, type => ({
    label: "Change to " + labelName,
    run(pm) { return setType(pm, type, attrs) },
    select(pm) {
      let {from, to, node} = pm.selection
      if (node)
        return node.isTextblock && !compareMarkup(type, node.type, attrs, node.attrs)
      else
        return !alreadyHasBlockType(pm.doc, from, to, type, attrs)
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
  let tr = pm.tr.clearSelection(), head = tr.selHead
  let parent = tr.doc.path(head.shorten().path)
  let node = type.create(attrs)
  if (!parent.type.canContain(node)) return false
  let off = 0
  if (head.offset) {
    tr.split(head)
    off = 1
  }
  return tr.insert(head.shorten(null, off), node).apply(andScroll)
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
    // FIXME do nothing if type is current type
    let sel = pm.selection
    return pm.tr.setBlockType(sel.from, sel.to, type).apply()
  },
  select(pm) {
    let selectedNode = pm.sel.node
    return !selectedNode || selectedNode.isTextblock
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

function nodeAboveSelection(pm) {
  let node = pm.selection.nodePos
  if (node) return node.depth && node.shorten()

  let {head, anchor} = pm.selection, i = 0
  for (; i < head.depth && i < anchor.depth; i++)
    if (head.path[i] != anchor.path[i]) break
  return i == 0 ? false : head.shorten(i - 1)
}

defineCommand("selectParentBlock", {
  label: "Select parent node",
  run(pm) {
    let node = nodeAboveSelection(pm)
    if (!node) return false
    pm.setNodeSelection(node)
  },
  select(pm) {
    return nodeAboveSelection(pm)
  },
  info: {
    menuGroup: "block",
    menuRank: 90,
    key: "Esc"
  }
})

// FIXME we'll need some awareness of bidi motion here

function selectableBlockFromSelection(pm, dir) {
  let {head, nodePos, node} = pm.selection
  let pos = node && !node.isInline ? (dir > 0 ? nodePos.move(1) : nodePos) : head.shorten(null, dir > 0 ? 1 : 0)
  return selectableBlockFrom(pm.doc, pos, dir)
}

function selectBlockHorizontally(pm, dir) {
  let {head, empty, node, nodePos} = pm.selection
  if (!empty && !node) return false

  if (node && node.isInline) {
    pm.setSelection(dir > 0 ? nodePos.move(1) : nodePos)
    return true
  }

  let parent
  if (!node && (parent = pm.doc.path(head.path)) &&
      (dir > 0 ? head.offset < parent.maxOffset : head.offset)) {
    let {node: nextNode, innerOffset} = dir > 0 ? parent.childAfter(head.offset) : parent.childBefore(head.offset)
    if (nextNode && nextNode.type.selectable &&
        (dir > 0 ? !innerOffset : innerOffset == nextNode.offset)) {
      pm.setNodeSelection(dir < 0 ? head.move(-1) : head)
      return true
    }
    return false
  }

  let nextBlock = selectableBlockFromSelection(pm, dir)
  if (!nextBlock) return false
  let nextNode = pm.doc.path(nextBlock)
  if (!nextNode.isTextblock) {
    pm.setNodeSelection(new Pos(nextBlock, 0).shorten())
    return true
  } else if (node) {
    pm.setSelection(new Pos(nextBlock, dir < 0 ? nextNode.maxOffset : 0))
    return true
  }
  return false
}

// FIXME make scrolling into view an option that can be passed to setSelection etc

defineCommand("selectBlockLeft", {
  label: "Move the selection onto or out of the block to the left",
  run(pm) {
    let done = selectBlockHorizontally(pm, -1)
    if (done) pm.scrollIntoView()
    return done
  },
  info: {key: ["Left", "Mod-Left"]}
})

defineCommand("selectBlockRight", {
  label: "Move the selection onto or out of the block to the right",
  run(pm) {
    let done = selectBlockHorizontally(pm, 1)
    if (done) pm.scrollIntoView()
    return done
  },
  info: {key: ["Right", "Mod-Right"]}
})

function selectBlockVertically(pm, dir) {
  let {empty, head, nodePos, node} = pm.selection
  if (!empty && !node) return false

  let leavingTextblock = true
  if (!node || node.isInline) {
    let pos = !node ? head : dir > 0 ? nodePos.move(1) : nodePos
    leavingTextblock = verticalMotionLeavesTextblock(pm, pos, dir)
  }

  if (leavingTextblock) {
    let next = selectableBlockFromSelection(pm, dir)
    if (next && !pm.doc.path(next).isTextblock) {
      pm.setNodeSelection(new Pos(next, 0).shorten())
      if (!node) pm.sel.lastNonNodePos = head
      return true
    }
  }

  if (!node) return false

  if (node.isInline) {
    setDOMSelectionToPos(pm, nodePos)
    return false
  }

  let last = pm.sel.lastNonNodePos
  if (last) {
    let beyond = dir < 0 ? Pos.after(pm.doc, nodePos.move(1)) : Pos.before(pm.doc, nodePos)
    if (beyond && Pos.samePath(last.path, beyond.path)) {
      setDOMSelectionToPos(pm, last)
      return false
    }
  }

  pm.setSelection(Pos.near(pm.doc, dir < 0 ? nodePos : nodePos.move(1), dir))
  return true
}

defineCommand("selectBlockUp", {
  label: "Move the selection onto or out of the block above",
  run(pm) {
    let done = selectBlockVertically(pm, -1)
    if (done !== false) pm.scrollIntoView()
    return done
  },
  info: {key: "Up"}
})

defineCommand("selectBlockDown", {
  label: "Move the selection onto or out of the block below",
  run(pm) {
    let done = selectBlockVertically(pm, 1)
    if (done !== false) pm.scrollIntoView()
    return done
  },
  info: {key: "Down"}
})

// FIXME shift- ctrl- arrows, pageup, pagedown, etc, when a node is selected
