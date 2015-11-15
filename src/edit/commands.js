import {HardBreak, BulletList, OrderedList, BlockQuote, Heading, Paragraph, CodeBlock, HorizontalRule,
        StrongStyle, EmStyle, CodeStyle, LinkStyle, Image, NodeType, StyleType,
        Pos, containsStyle, rangeHasStyle, compareMarkup} from "../model"
import {joinPoint, joinableBlocks, canLift, canWrap, alreadyHasBlockType} from "../transform"
import {browser} from "../dom"
import sortedInsert from "../util/sortedinsert"

import {charCategory, isExtendingChar} from "./char"
import {Keymap} from "./keys"
import {findSelectionFrom, verticalMotionLeavesTextblock, setDOMSelectionToPos, NodeSelection} from "./selection"

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
    this.info = options
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
    let {node, from} = pm.selection
    if (node && node.isBlock)
      return false
    else if (pm.doc.path(from.path).type.isCode)
      return pm.typeText("\n").apply(andScroll)
    else
      return pm.replaceSelection(type.create()).apply(andScroll)
  },
  key: ["Mod-Enter", "Shift-Enter"]
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
    run(pm) { pm.setStyle(type, true) },
    select(pm) { return canAddInline(pm, type) }
  }))
  type.attachCommand("unset" + cap, type => ({
    label: "Remove " + labelName,
    run(pm) { pm.setStyle(type, false) },
    select(pm) { return inlineStyleActive(pm, type) }
  }))
  type.attachCommand(name, type => {
    let command = {
      label: "Toggle " + labelName,
      run(pm) { pm.setStyle(type, null) },
      active(pm) { return inlineStyleActive(pm, type) },
      select(pm) { return inlineStyleApplies(pm, type) },
      info
    }
    for (let prop in info) command[prop] = info[prop]
    return command
  })
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
  menuGroup: "inline", menuRank: 30
}))
LinkStyle.attachCommand("link", type => ({
  label: "Add link",
  run(pm, href, title) { pm.setStyle(type, true, {href, title}) },
  params: [
    {name: "Target", type: "text"},
    {name: "Title", type: "text", default: ""}
  ],
  select(pm) { return inlineStyleApplies(pm, type) && !inlineStyleActive(pm, type) },
  menuGroup: "inline", menuRank: 30
}))

Image.attachCommand("insertImage", type => ({
  label: "Insert image",
  run(pm, src, alt, title) {
    return pm.replaceSelection(type.create({src, title, alt})).apply(andScroll)
  },
  params: [
    {name: "Image URL", type: "text"},
    {name: "Description / alternative text", type: "text", default: ""},
    {name: "Title", type: "text", default: ""}
  ],
  select(pm) {
    return pm.doc.path(pm.selection.from.path).type.canContainType(type)
  },
  menuGroup: "inline",
  menuRank: 40,
  prefillParams(pm) {
    let {node} = pm.selection
    if (node && node.type == type)
      return [node.attrs.src, node.attrs.alt, node.attrs.title]
  }
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
    return pm.replaceSelection().apply(andScroll)
  },
  key: ["Backspace(10)", "Delete(10)", "Mod-Backspace(10)", "Mod-Delete(10)"],
  macKey: ["Ctrl-H(10)", "Alt-Backspace(10)", "Ctrl-D(10)", "Ctrl-Alt-Backspace(10)", "Alt-Delete(10)", "Alt-D(10)"]
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

  let selAfter = findSelectionFrom(pm.doc, cut, 1)
  return pm.tr.lift(selAfter.from, selAfter.to).apply(andScroll)
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
      return pm.tr.lift(head).apply(andScroll)

    // If the node doesn't allow children, delete it
    if (before.type.contains == null)
      return pm.tr.delete(cut.move(-1), cut).apply(andScroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  key: ["Backspace(30)", "Mod-Backspace(30)"]
})

defineCommand("deleteCharBefore", {
  label: "Delete a character before the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "char")
    return pm.tr.delete(new Pos(head.path, from), head).apply(andScroll)
  },
  key: "Backspace(60)",
  macKey: "Ctrl-H(40)"
})

defineCommand("deleteWordBefore", {
  label: "Delete the word before the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == 0) return false
    let from = moveBackward(pm.doc.path(head.path), head.offset, "word")
    return pm.tr.delete(new Pos(head.path, from), head).apply(andScroll)
  },
  key: "Mod-Backspace(40)",
  macKey: "Alt-Backspace(40)"
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
      return pm.tr.delete(cut, cut.move(1)).apply(andScroll)

    // Apply the joining algorithm
    return deleteBarrier(pm, cut)
  },
  key: ["Delete(30)", "Mod-Delete(30)"]
})

defineCommand("deleteCharAfter", {
  label: "Delete a character after the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == pm.doc.path(head.path).maxOffset) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "char")
    return pm.tr.delete(head, new Pos(head.path, to)).apply(andScroll)
  },
  key: "Delete(60)",
  macKey: "Ctrl-D(60)"
})

defineCommand("deleteWordAfter", {
  label: "Delete a character after the cursor",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset == pm.doc.path(head.path).maxOffset) return false
    let to = moveForward(pm.doc.path(head.path), head.offset, "word")
    return pm.tr.delete(head, new Pos(head.path, to)).apply(andScroll)
  },
  key: "Mod-Delete(40)",
  macKey: ["Ctrl-Alt-Backspace(40)", "Alt-Delete(40)", "Alt-D(40)"]
})

function joinPointAbove(pm) {
  let {node, from} = pm.selection
  if (node) return joinableBlocks(pm.doc, from) ? from : null
  else return joinPoint(pm.doc, from, -1)
}

defineCommand("joinUp", {
  label: "Join with above block",
  run(pm) {
    let node = pm.selection.node
    let point = joinPointAbove(pm)
    if (!point) return false
    pm.tr.join(point).apply()
    if (node) pm.setNodeSelection(point.move(-1))
  },
  select(pm) { return joinPointAbove(pm) },
  menuGroup: "block", menuRank: 80,
  key: "Alt-Up"
})

function joinPointBelow(pm) {
  let {node, to} = pm.selection
  if (node) return joinableBlocks(pm.doc, to) ? to : null
  else return joinPoint(pm.doc, to, 1)
}

defineCommand("joinDown", {
  label: "Join with below block",
  run(pm) {
    let node = pm.selection.node
    let point = joinPointBelow(pm)
    if (!point) return false
    pm.tr.join(point).apply()
    if (node) pm.setNodeSelection(point.move(-1))
  },
  select(pm) { return joinPointBelow(pm) },
  key: "Alt-Down"
})

defineCommand("lift", {
  label: "Lift out of enclosing block",
  run(pm) {
    let {from, to} = pm.selection
    return pm.tr.lift(from, to).apply(andScroll)
  },
  select(pm) {
    let {from, to} = pm.selection
    return canLift(pm.doc, from, to)
  },
  menuGroup: "block", menuRank: 75,
  key: "Alt-Left"
})

function wrapCommand(type, name, labelName, info) {
  type.attachCommand("wrap" + name, type => {
    let command = {
      label: "Wrap in " + labelName,
      run(pm) {
        let {from, to} = pm.selection
        return pm.tr.wrap(from, to, type.create()).apply(andScroll)
      },
      select(pm) {
        let {from, to} = pm.selection
        return canWrap(pm.doc, from, to, type.create())
      }
    }
    for (let key in info) command[key] = info[key]
    return command
  })
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
    let {from, to, node} = pm.selection, block
    if (!node && Pos.samePath(from.path, to.path) &&
        (block = pm.doc.path(from.path)).type.isCode &&
        to.offset < block.maxOffset)
      return pm.typeText("\n").apply(andScroll)
    else
      return false
  },
  key: "Enter(10)"
})

defineCommand("createParagraphNear", {
  label: "Create a paragraph near the selected leaf block",
  run(pm) {
    let {from, to, node} = pm.selection
    if (!node || !node.isBlock || node.type.contains) return false
    let side = from.offset ? to : from
    pm.tr.insert(side, pm.schema.defaultTextblockType().create()).apply(andScroll)
    pm.setSelection(new Pos(side.toPath(), 0))
  },
  key: "Enter(20)"
})

defineCommand("liftEmptyBlock", {
  label: "Move current block up",
  run(pm) {
    let {head, empty} = pm.selection
    if (!empty || head.offset > 0) return false
    if (head.path[head.path.length - 1] > 0 &&
        pm.tr.split(head.shorten()).apply() !== false)
      return
    return pm.tr.lift(head).apply(andScroll)
  },
  key: "Enter(30)"
})

defineCommand("splitBlock", {
  label: "Split the current block",
  run(pm) {
    let {from, to, node} = pm.selection, block = pm.doc.path(to.path)
    if (node && node.isBlock) {
      if (!from.offset) return false
      return pm.tr.split(from).apply(andScroll)
    } else {
      let type = to.offset == block.maxOffset ? pm.schema.defaultTextblockType().create() : null
      return pm.tr.delete(from, to).split(from, 1, type).apply(andScroll)
    }
  },
  key: "Enter(60)"
})

function blockTypeCommand(type, name, labelName, attrs, key) {
  if (!attrs) attrs = {}
  type.attachCommand(name, type => ({
    label: "Change to " + labelName,
    run(pm) {
      let {from, to} = pm.selection
      return pm.tr.setBlockType(from, to, pm.schema.node(type, attrs)).apply(andScroll)
    },
    select(pm) {
      let {from, to, node} = pm.selection
      if (node)
        return node.isTextblock && !compareMarkup(type, node.type, attrs, node.attrs)
      else
        return !alreadyHasBlockType(pm.doc, from, to, type, attrs)
    },
    key
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

HorizontalRule.attachCommand("insertHorizontalRule", type => ({
  label: "Insert horizontal rule",
  run(pm) {
    return pm.replaceSelection(type.create()).apply(andScroll)
  },
  key: "Mod-Space"
}))

defineCommand("undo", {
  label: "Undo last change",
  run(pm) { pm.scrollIntoView(); return pm.history.undo() },
  select(pm) { return pm.history.canUndo() },
  menuGroup: "history",
  menuRank: 10,
  key: "Mod-Z"
})

defineCommand("redo", {
  label: "Redo last undone change",
  run(pm) { pm.scrollIntoView(); return pm.history.redo() },
  select(pm) { return pm.history.canRedo() },
  menuGroup: "history",
  menuRank: 20,
  key: ["Mod-Y", "Shift-Mod-Z"]
})

defineCommand("textblockType", {
  label: "Change block type",
  run(pm, type) {
    let {from, to} = pm.selection
    return pm.tr.setBlockType(from, to, type).apply()
  },
  select(pm) {
    let {node} = pm.selection
    return !node || node.isTextblock
  },
  params: [
    {name: "Type", type: "select", options: listTextblockTypes, default: currentTextblockType, defaultLabel: "Type..."}
  ],
  display: "select",
  menuGroup: "block", menuRank: 10
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
  let {from, to, node} = pm.selection
  if (!node || node.isInline) {
    if (!Pos.samePath(from.path, to.path)) return null
    node = pm.doc.path(from.path)
  } else if (!node.isTextblock) {
    return null
  }
  let types = listTextblockTypes(pm)
  for (let i = 0; i < types.length; i++)
    if (types[i].value.sameMarkup(node)) return types[i]
}

function nodeAboveSelection(pm) {
  let sel = pm.selection, i = 0
  if (sel.node) return !!sel.from.depth && sel.from.shorten()
  for (; i < sel.head.depth && i < sel.anchor.depth; i++)
    if (sel.head.path[i] != sel.anchor.path[i]) break
  return i == 0 ? false : sel.head.shorten(i - 1)
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
  menuGroup: "block",
  menuRank: 90,
  key: "Esc"
})

function moveSelectionBlock(pm, dir) {
  let {from, to, node} = pm.selection
  let side = dir > 0 ? to : from
  return findSelectionFrom(pm.doc, node && node.isBlock ? side : side.shorten(null, dir > 0 ? 1 : 0), dir)
}

function selectBlockHorizontally(pm, dir) {
  let {empty, node, from, to} = pm.selection
  if (!empty && !node) return false

  if (node && node.isInline) {
    pm.setSelection(dir > 0 ? to : from)
    return true
  }

  let parent
  if (!node && (parent = pm.doc.path(from.path)) &&
      (dir > 0 ? from.offset < parent.maxOffset : from.offset)) {
    let {node: nextNode, innerOffset} = dir > 0 ? parent.childAfter(from.offset) : parent.childBefore(from.offset)
    if (nextNode && nextNode.type.selectable &&
        (dir > 0 ? !innerOffset : innerOffset == nextNode.offset)) {
      pm.setNodeSelection(dir < 0 ? from.move(-1) : from)
      return true
    }
    return false
  }

  let next = moveSelectionBlock(pm, dir)
  if (next && (next instanceof NodeSelection || node)) {
    pm.setSelection(next)
    return true
  }
  return false
}

defineCommand("selectBlockLeft", {
  label: "Move the selection onto or out of the block to the left",
  run(pm) {
    let done = selectBlockHorizontally(pm, -1)
    if (done) pm.scrollIntoView()
    return done
  },
  key: ["Left", "Mod-Left"]
})

defineCommand("selectBlockRight", {
  label: "Move the selection onto or out of the block to the right",
  run(pm) {
    let done = selectBlockHorizontally(pm, 1)
    if (done) pm.scrollIntoView()
    return done
  },
  key: ["Right", "Mod-Right"]
})

function selectBlockVertically(pm, dir) {
  let {empty, node, from, to} = pm.selection
  if (!empty && !node) return false

  let leavingTextblock = true
  if (!node || node.isInline)
    leavingTextblock = verticalMotionLeavesTextblock(pm, dir > 0 ? to : from, dir)

  if (leavingTextblock) {
    let next = moveSelectionBlock(pm, dir)
    if (next && (next instanceof NodeSelection)) {
      pm.setSelection(next)
      if (!node) pm.sel.lastNonNodePos = from
      return true
    }
  }

  if (!node) return false

  if (node.isInline) {
    setDOMSelectionToPos(pm, from)
    return false
  }

  let last = pm.sel.lastNonNodePos
  let beyond = findSelectionFrom(pm.doc, dir < 0 ? from : to, dir)
  if (last && beyond && Pos.samePath(last.path, beyond.from.path)) {
    setDOMSelectionToPos(pm, last)
    return false
  }
  pm.setSelection(beyond)
  return true
}

defineCommand("selectBlockUp", {
  label: "Move the selection onto or out of the block above",
  run(pm) {
    let done = selectBlockVertically(pm, -1)
    if (done !== false) pm.scrollIntoView()
    return done
  },
  key: "Up"
})

defineCommand("selectBlockDown", {
  label: "Move the selection onto or out of the block below",
  run(pm) {
    let done = selectBlockVertically(pm, 1)
    if (done !== false) pm.scrollIntoView()
    return done
  },
  key: "Down"
})
