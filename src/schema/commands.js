import Keymap from "browserkeymap"
import {HardBreak, BulletList, OrderedList, ListItem, BlockQuote, HorizontalRule,
        Paragraph, CodeBlock, Heading, StrongMark, EmMark, CodeMark} from "../schema"
import {browser} from "../dom"
import {wrapIn, setBlockType} from "../edit/base_commands"
import {Fragment, Slice} from "../model"
import {canSplit, ReplaceAroundStep} from "../transform"
import {Plugin} from "../edit"

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
      keys["Shift-Ctrl-8"] = pm => wrapList(pm, node)
    if (node instanceof OrderedList)
      keys["Shift-Ctrl-9"] = pm => wrapList(pm, node)
    if (node instanceof BlockQuote)
      keys["Shift-Ctrl-."] = pm => wrapIn(pm, node)
    if (node instanceof HardBreak) {
      let cmd = pm => pm.tr.replaceSelection(node.create())
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
      keys["Mod-Shift--"] = pm => pm.tr.replaceSelection(node.create())
  }
  return new Keymap(keys)
}

export const addSchemaKeys = new Plugin(class {
  constructor(pm) {
    this.keymap = defaultSchemaKeymap(pm.schema)
    pm.addKeymap(this.keymap)
  }
  detach(pm) {
    pm.removeKeymap(this.keymap)
  }
})

function isAtTopOfListItem(doc, from, to, listType) {
  let $from = doc.resolve(from)
  return $from.sameParent(doc.resolve(to)) &&
    $from.depth >= 2 &&
    $from.index(-1) == 0 &&
    $from.node(-2).type.compatibleContent(listType)
}

export function wrapList(pm, nodeType, attrs, apply) {
  let {from, to, head} = pm.selection, doJoin = false
  let $from = pm.doc.resolve(from)
  if (head && isAtTopOfListItem(pm.doc, from, to, nodeType)) {
    // Don't do anything if this is the top of the list
    if ($from.index(-2) == 0) return false
    doJoin = true
  }
  if (apply !== false) {
    let tr = pm.tr.wrap(from, to, nodeType, attrs)
    if (doJoin) tr.join($from.before(-1))
    tr.apply(pm.apply.scroll)
  }
  return true
}

export function splitListItem(pm, nodeType) {
  let {from, to, node} = pm.selection, $from = pm.doc.resolve(from)
  if ((node && node.isBlock) ||
      $from.depth < 2 || !$from.sameParent(pm.doc.resolve(to))) return false
  let grandParent = $from.node(-1)
  if (grandParent.type != nodeType) return false
  let nextType = to == $from.end() ? grandParent.defaultContentType($from.indexAfter(-1)) : null
  let tr = pm.tr.delete(from, to)
  if (!canSplit(tr.doc, from, 2, nextType)) return false
  tr.split(from, 2, nextType).apply(pm.apply.scroll)
  return true
}

function selectedListItems(pm, type) {
  let {node, from, to} = pm.selection, $from = pm.doc.resolve(from)
  if (node && node.type == type) return {from, to, depth: $from.depth + 1}

  let itemDepth = $from.parent.type == type ? $from.depth
      : $from.depth > 0 && $from.node(-1).type == type ? $from.depth - 1 : null
  if (itemDepth == null) return

  let $to = pm.doc.resolve(to)
  if ($from.sameDepth($to) < itemDepth - 1) return null
  return {from: $from.before(itemDepth),
          to: $to.after(itemDepth),
          depth: itemDepth}
}

export function liftListItem(pm, nodeType) {
  let selected = selectedListItems(pm, nodeType)
  if (!selected || selected.depth < 3) return false
  let $to = pm.doc.resolve(pm.selection.to)
  if ($to.node(selected.depth - 2).type != nodeType) return false
  let itemsAfter = selected.to < $to.end(selected.depth - 1)
  let tr = pm.tr.lift(selected.from, selected.to)
  let end = tr.map(selected.to, -1)
  if (itemsAfter) tr.join(end)
  tr.apply(pm.apply.scroll)
  return true
}

export function sinkListItem(pm, nodeType) {
  let selected = selectedListItems(pm, nodeType)
  if (!selected) return false
  let $from = pm.doc.resolve(pm.selection.from), startIndex = $from.index(selected.depth - 1)
  if (startIndex == 0) return false
  let parent = $from.node(selected.depth - 1), before = parent.child(startIndex - 1)
  if (before.type != nodeType) return false
  let nestedBefore = before.lastChild && before.lastChild.type == parent.type
  let slice = new Slice(Fragment.from(nodeType.create(null, parent.type.create(parent.attrs))), nestedBefore ? 2 : 1, 0)
  pm.tr.step(new ReplaceAroundStep(selected.from - (nestedBefore ? 2 : 1), selected.to,
                                   selected.from, selected.to, slice, nestedBefore ? 0 : 1, true))
    .apply(pm.apply.scroll)
  return true
}
