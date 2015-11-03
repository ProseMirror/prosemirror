import "./css"

import {spanStylesAt, rangeHasStyle, sliceBetween, Pos, findDiffStart,
        containsStyle, removeStyle} from "../model"
import {Transform} from "../transform"
import sortedInsert from "../util/sortedinsert"

import {parseOptions, initOptions, setOption} from "./options"
import {Selection, Range, posAtCoords, posFromDOM, coordsAtPos, scrollIntoView, hasFocus} from "./selection"
import {requestAnimationFrame, elt} from "../dom"
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
    this.flushScheduled = false

    this.sel = new Selection(this)
    this.input = new Input(this)

    this.commands = initCommands(this.schema)

    initOptions(this)
  }

  /**
   * @return {Range} The instance of the editor's selection range.
   */
  get selection() {
    // FIXME only start an op when selection actually changed?
    this.ensureOperation()
    return this.sel.range
  }

  get selectedNode() {
    this.ensureOperation()
    return this.sel.selectedNode()
  }

  get selectedNodePath() {
    this.ensureOperation()
    return this.sel.node
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
  get tr() { return new Transform(this.doc) }

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
      sel = new Range(start, start)
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
    this.sel.map(mapping)
    this.signal("change")
  }

  checkPos(pos, block) {
    if (!this.doc.isValidPos(pos, block))
      throw new Error("Position " + pos + " is not valid in current document")
  }

  setSelection(rangeOrAnchor, head) {
    let range = rangeOrAnchor
    if (!(range instanceof Range))
      range = new Range(rangeOrAnchor, head || rangeOrAnchor)
    this.checkPos(range.head, true)
    this.checkPos(range.anchor, true)
    this.ensureOperation()
    this.input.maybeAbortComposition()
    if (range.head.cmp(this.sel.range.head) ||
        range.anchor.cmp(this.sel.range.anchor))
      this.sel.setAndSignal(range)
  }

  setNodeSelection(pos) {
    this.checkPos(pos, false)
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

    let docChanged = op.doc != this.doc || this.ranges.dirty.size
    if (docChanged && !this.input.composing) {
      if (op.fullRedraw) draw(this, this.doc) // FIXME only redraw target block composition
      else redraw(this, this.ranges.dirty, this.doc, op.doc)
      this.ranges.resetDirty()
    }
    if ((docChanged || op.sel.anchor.cmp(this.sel.range.anchor) || op.sel.head.cmp(this.sel.range.head) ||
         (op.selNode ? !this.sel.node || this.sel.node.cmp(op.selNode) : this.sel.node)) &&
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

  // FIXME stop requiring marker instance?
  setStyle(st, to) {
    let sel = this.selection
    if (sel.empty) {
      let styles = this.activeStyles()
      if (to == null) to = !containsStyle(styles, st.type)
      if (to && !this.doc.path(sel.head.path).type.canContainStyle(st.type)) return
      this.input.storedStyles = to ? st.addToSet(styles) : removeStyle(styles, st.type)
      this.signal("activeStyleChange")
    } else {
      if (to != null ? to : !rangeHasStyle(this.doc, sel.from, sel.to, st.type))
        this.apply(this.tr.addStyle(sel.from, sel.to, st))
      else
        this.apply(this.tr.removeStyle(sel.from, sel.to, st.type))
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

  posFromDOM(element, offset) {
    // FIXME do some input checking
    return posFromDOM(this, element, offset)
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
}

const nullOptions = {}

eventMixin(ProseMirror)

class Operation {
  constructor(pm) {
    this.doc = pm.doc
    this.sel = pm.sel.range
    this.selNode = pm.sel.node
    this.scrollIntoView = false
    this.focus = false
    this.fullRedraw = !!pm.input.composing
  }
}
