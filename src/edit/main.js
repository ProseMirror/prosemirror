import "./css"

import {spanStylesAt, rangeHasStyle, sliceBetween, Pos, findDiffStart,
        containsStyle, removeStyle} from "../model"
import {Transform} from "../transform"
import sortedInsert from "../util/sortedinsert"
import {Map} from "../util/map"

import {parseOptions, initOptions, setOption} from "./options"
import {Selection, SelectionRange, posAtCoords, posFromDOM, coordsAtPos,
        scrollIntoView, hasFocus} from "./selection"
import {requestAnimationFrame, elt, browser} from "../dom"
import {draw, redraw} from "./draw"
import {Input} from "./input"
import {History} from "./history"
import {eventMixin} from "./event"
import {toText} from "../serialize/text"
import "../parse/text"
import {convertFrom} from "../parse"
import {convertTo} from "../serialize"
import {initCommands} from "./commands"
import {RangeStore, MarkedRange} from "./range"
import {normalizeKeyName} from "./keys"

/**
 * ProseMirror editor class.
 * @class
 */
export class ProseMirror {
  /**
   * @param {Object} opts        Instance options hash.
   * @param {Object} opts.schema The document model schema for the editor instance.
   * @param {Object} opts.doc    The document model for the instance. Optional.
   */
  constructor(opts) {
    opts = this.options = parseOptions(opts)
    this.schema = opts.schema
    if (opts.doc == null) opts.doc = this.schema.node("doc", null, [this.schema.node("paragraph")])
    this.content = elt("div", {class: "ProseMirror-content"})
    this.wrapper = elt("div", {class: "ProseMirror"}, this.content)
    this.wrapper.ProseMirror = this

    if (opts.place && opts.place.appendChild)
      opts.place.appendChild(this.wrapper)
    else if (opts.place)
      opts.place(this.wrapper)

    this.setDocInner(opts.docFormat ? convertFrom(this.schema, opts.doc, opts.docFormat, {document}) : opts.doc)
    draw(this, this.doc)
    this.content.contentEditable = true

    this.mod = Object.create(null)
    this.operation = null
    this.dirtyNodes = new Map // Maps node object to 1 (re-scan content) or 2 (redraw entirely)
    this.flushScheduled = false

    this.sel = new Selection(this)
    this.input = new Input(this)

    this.commands = initCommands(this.schema)
    this.commandKeys = Object.create(null)

    initOptions(this)
  }

  /**
   * @return {Range} The instance of the editor's selection range.
   */
  get selection() {
    this.ensureOperation()
    return this.sel.range
  }

  get selectedDoc() {
    let sel = this.selection
    return sliceBetween(this.doc, sel.from, sel.to)
  }

  get selectedText() {
    return toText(this.selectedDoc)
  }

  /**
   * Apply a transform on the editor.
   */
  apply(transform, options = nullOptions) {
    if (transform.doc == this.doc) return false
    if (transform.docs[0] != this.doc && findDiffStart(transform.docs[0], this.doc))
      throw new Error("Applying a transform that does not start with the current document")

    this.updateDoc(transform.doc, transform)
    this.signal("transform", transform, options)
    if (options.scrollIntoView) this.scrollIntoView()
    return transform
  }

  /**
   * @return {Transform} A new transform object.
   */
  get tr() { return new EditorTransform(this) }

  setContent(value, format) {
    if (format) value = convertFrom(this.schema, value, format)
    this.setDoc(value)
  }

  getContent(format) {
    return format ? convertTo(this.doc, format) : this.doc
  }

  setDocInner(doc) {
    if (doc.type != this.schema.nodes.doc)
      throw new Error("Trying to set a document with a different schema")
    this.doc = doc
    this.ranges = new RangeStore(this)
    this.history = new History(this)
  }

  setDoc(doc, sel) {
    if (!sel) {
      let start = Pos.start(doc)
      sel = new SelectionRange(this.doc, start, start)
    }
    this.signal("beforeSetDoc", doc, sel)
    this.ensureOperation()
    this.setDocInner(doc)
    this.sel.set(sel, true)
    this.signal("setDoc", doc, sel)
  }

  updateDoc(doc, mapping) {
    this.ensureOperation()
    this.input.maybeAbortComposition()
    this.ranges.transform(mapping)
    this.doc = doc
    this.sel.setAndSignal(this.sel.map(mapping))
    this.signal("change")
  }

  checkPos(pos, block) {
    if (!this.doc.isValidPos(pos, block))
      throw new Error("Position " + pos + " is not valid in current document")
  }

  setSelection(rangeOrAnchor, head) {
    let range = rangeOrAnchor
    if (!(range instanceof SelectionRange))
      range = new SelectionRange(this.doc, rangeOrAnchor, head || rangeOrAnchor)
    this.checkPos(range.head, true)
    this.checkPos(range.anchor, true)
    this.ensureOperation()
    this.input.maybeAbortComposition()
    if (range.cmp(this.sel.range)) this.sel.setAndSignal(range)
  }

  setNodeSelection(pos) {
    this.checkPos(pos, false)
    this.input.maybeAbortComposition()
    this.sel.setNodeAndSignal(pos)
  }

  ensureOperation() {
    if (!this.operation) {
      this.sel.beforeStartOp()
      this.operation = new Operation(this)
    }
    if (!this.flushScheduled) {
      requestAnimationFrame(() => {
        this.flushScheduled = false
        this.flush()
      })
      this.flushScheduled = true
    }
    return this.operation
  }

  flush() {
    let op = this.operation
    if (!op || !document.body.contains(this.wrapper)) return
    this.operation = null

    let docChanged = op.doc != this.doc || this.dirtyNodes.size, redrawn = false
    if (!this.input.composing && (docChanged || op.composingAtStart)) {
      redraw(this, this.dirtyNodes, this.doc, op.doc)
      this.dirtyNodes.clear()
      redrawn = true
    }

    if ((redrawn ||
         op.sel.anchor.cmp(this.sel.range.anchor) || op.sel.head.cmp(this.sel.range.head) ||
         (op.sel.nodePos ? !this.sel.range.nodePos || this.sel.range.nodePos.cmp(op.sel.nodePos) : this.sel.range.nodePos)) &&
        !this.input.composing)
      this.sel.toDOM(op.focus)

    if (op.scrollIntoView !== false)
      scrollIntoView(this, op.scrollIntoView)
    if (docChanged) this.signal("draw")
    this.signal("flush")
  }

  setOption(name, value) { setOption(this, name, value) }
  getOption(name) { return this.options[name] }

  addKeymap(map, rank = 50) {
    sortedInsert(this.input.keymaps, {map, rank}, (a, b) => a.rank - b.rank)
  }

  removeKeymap(map) {
    let maps = this.input.keymaps
    for (let i = 0; i < maps.length; ++i) if (maps[i].map == map || maps[i].map.options.name == map) {
      maps.splice(i, 1)
      return true
    }
  }

  markRange(from, to, options) {
    this.checkPos(from)
    this.checkPos(to)
    let range = new MarkedRange(from, to, options)
    this.ranges.addRange(range)
    return range
  }

  removeRange(range) {
    this.ranges.removeRange(range)
  }

  setStyle(type, to, attrs) {
    let sel = this.selection
    if (sel.empty) {
      let styles = this.activeStyles()
      if (to == null) to = !containsStyle(styles, type)
      if (to && !this.doc.path(sel.head.path).type.canContainStyle(type)) return
      this.input.storedStyles = to ? type.create(attrs).addToSet(styles) : removeStyle(styles, type)
      this.signal("activeStyleChange")
    } else {
      if (to != null ? to : !rangeHasStyle(this.doc, sel.from, sel.to, type))
        this.apply(this.tr.addStyle(sel.from, sel.to, type.create(attrs)))
      else
        this.apply(this.tr.removeStyle(sel.from, sel.to, type))
    }
  }

  activeStyles() {
    return this.input.storedStyles || spanStylesAt(this.doc, this.selection.head)
  }

  focus() {
    if (this.operation) this.operation.focus = true
    else this.sel.toDOM(true)
  }

  hasFocus() {
    return hasFocus(this)
  }

  posAtCoords(coords) {
    return posAtCoords(this, coords)
  }

  posFromDOM(element, offset, textblock) {
    if (!this.content.contains(element)) return Pos.start(this.doc)
    let pos = posFromDOM(this, element, offset)
    if (textblock !== false && !this.doc.path(pos.path).isTextblock)
      pos = Pos.near(this.doc, pos)
    return pos
  }

  coordsAtPos(pos) {
    this.checkPos(pos)
    return coordsAtPos(this, pos)
  }

  scrollIntoView(pos = null) {
    if (pos) this.checkPos(pos)
    this.ensureOperation()
    this.operation.scrollIntoView = pos
  }

  execCommand(name, params) {
    let cmd = this.commands[name]
    return !!(cmd && cmd.exec(this, params) !== false)
  }

  keyForCommand(name) {
    let cached = this.commandKeys[name]
    if (cached !== undefined) return cached

    let cmd = this.commands[name]
    if (!cmd) return this.commandKeys[name] = null
    let key = cmd.info.key || (browser.mac ? cmd.info.macKey : cmd.info.pcKey)
    if (key) {
      key = normalizeKeyName(Array.isArray(key) ? key[0] : key)
      let deflt = this.options.keymap.bindings[key]
      if (Array.isArray(deflt) ? deflt.indexOf(name) > -1 : deflt == name)
        return this.commandKeys[name] = key
    }
    for (let key in this.options.keymap.bindings) {
      let bound = this.options.keymap.bindings[key]
      if (Array.isArray(bound) ? bound.indexOf(name) > -1 : bound == name)
        return this.commandKeys[name] = key
    }
    return this.commandKeys[name] = null
  }

  markRangeDirty(range) {
    this.ensureOperation()
    let dirty = this.dirtyNodes
    let from = range.from, to = range.to
    for (let depth = 0, node = this.doc;; depth++) {
      let fromEnd = depth == from.depth, toEnd = depth == to.depth
      if (!fromEnd && !toEnd && from.path[depth] == to.path[depth]) {
        let child = node.child(from.path[depth])
        if (!dirty.has(child)) dirty.set(child, 1)
        node = child
      } else {
        let start = fromEnd ? from.offset : from.path[depth]
        let end = toEnd ? to.offset : to.path[depth] + 1
        if (node.isTextblock) {
          for (let offset = 0, i = 0; offset < end; i++) {
            let child = node.child(i)
            offset += child.offset
            if (offset > start) dirty.set(child, 2)
          }
        } else {
          for (let i = start; i < end; i++)
            dirty.set(node.child(i), 2)
        }
        break
      }
    }
  }
}

const nullOptions = {}

eventMixin(ProseMirror)

class Operation {
  constructor(pm) {
    this.doc = pm.doc
    this.sel = pm.sel.range
    this.scrollIntoView = false
    this.focus = false
    this.composingAtStart = !!pm.input.composing
  }
}

class EditorTransform extends Transform {
  constructor(pm) {
    super(pm.doc)
    this.pm = pm
  }

  clearSelection() {
    let {empty, from, to, nodePos, node} = this.pm.selection
    if (nodePos && node.type.contains == null)
      this.delete(nodePos, nodePos.move(1))
    else if (!empty)
      this.delete(from, to)
    return this
  }

  type(text) {
    let styles = (!this.steps.length && this.pm.input.storedStyles) || spanStylesAt(this.doc, this.selFrom)
    this.clearSelection()
    this.insert(this.selFrom, this.pm.schema.text(text, styles))
    return this
  }

  get selHead() { return this.map(this.pm.selection.head).pos }
  get selFrom() { return this.map(this.pm.selection.from).pos }
  get selTo() { return this.map(this.pm.selection.to).pos }

  apply(options) {
    return this.pm.apply(this, options)
  }
}
