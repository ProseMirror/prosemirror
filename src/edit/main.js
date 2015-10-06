import "./css"

import {spanStylesAt, rangeHasStyle, style, sliceBetween, Pos, findDiffStart} from "../model"
import {Transform} from "../transform"

import {parseOptions, initOptions, setOption} from "./options"
import {Selection, Range, posAtCoords, coordsAtPos, scrollIntoView, hasFocus} from "./selection"
import {requestAnimationFrame, elt} from "../dom"
import {draw, redraw} from "./draw"
import {Input} from "./input"
import {History} from "./history"
import {eventMixin} from "./event"
import {toText} from "../convert/to_text"
import "../convert/from_text"
import {convertFrom, convertTo} from "../convert"
import {execCommand} from "./commands"
import {RangeStore, MarkedRange} from "./range"

export class ProseMirror {
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

    initOptions(this)
  }

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

  apply(transform, options = nullOptions) {
    if (transform.doc == this.doc) return false
    if (transform.docs[0] != this.doc && findDiffStart(transform.docs[0], this.doc))
      throw new Error("Applying a transform that does not start with the current document")

    this.updateDoc(transform.doc, transform)
    this.signal("transform", transform, options)
    return transform
  }

  get tr() { return new Transform(this.doc) }

  setContent(value, format) {
    if (format) value = convertFrom(this.schema, value, format, {document})
    this.setDoc(value)
  }

  getContent(format) {
    return format ? convertTo(this.doc, format, {document}) : this.doc
  }

  setDocInner(doc) {
    if (doc.type != this.schema.nodeTypes.doc)
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
    let range = this.sel.range
    this.sel.setAndSignal(new Range(mapping.map(range.anchor).pos,
                                    mapping.map(range.head).pos))
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

  ensureOperation() {
    if (!this.operation) {
      if (!this.input.suppressPolling) this.sel.poll()
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
    if ((docChanged || op.sel.anchor.cmp(this.sel.range.anchor) || op.sel.head.cmp(this.sel.range.head)) &&
        !this.input.composing)
      this.sel.toDOM(docChanged, op.focus)
    if (op.scrollIntoView !== false)
      scrollIntoView(this, op.scrollIntoView)
    if (docChanged) this.signal("draw")
    this.signal("flush")
  }

  setOption(name, value) { setOption(this, name, value) }
  getOption(name) { return this.options[name] }

  addKeymap(map, bottom) {
    this.input.keymaps[bottom ? "push" : "unshift"](map)
  }

  removeKeymap(map) {
    let maps = this.input.keymaps
    for (let i = 0; i < maps.length; ++i) if (maps[i] == map || maps[i].options.name == map) {
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

  setStyle(st, to) {
    let sel = this.selection
    if (sel.empty) {
      let styles = this.activeStyles()
      if (to == null) to = !style.containsType(styles, st.type)
      this.input.storedStyles = to ? style.add(styles, st) : style.removeType(styles, st.type)
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
    else this.sel.toDOM(false, true)
  }

  hasFocus() {
    return hasFocus(this)
  }

  posAtCoords(coords) {
    return posAtCoords(this, coords)
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

  execCommand(name) { execCommand(this, name) }
}

const nullOptions = {}

eventMixin(ProseMirror)

class Operation {
  constructor(pm) {
    this.doc = pm.doc
    this.sel = pm.sel.range
    this.scrollIntoView = false
    this.focus = false
    this.fullRedraw = !!pm.input.composing
  }
}
