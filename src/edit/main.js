import "./editor.css"

import {inline, style, slice, Pos} from "../model"
import {Transform} from "../transform"

import {parseOptions, initOptions, setOption} from "./options"
import {Selection, Range, posAtCoords, coordsAtPos, scrollIntoView, hasFocus} from "./selection"
import * as dom from "./dom"
import {draw, redraw} from "./draw"
import {Input} from "./input"
import {History} from "./history"
import {eventMixin} from "./event"
import text from "./text"
import {execCommand} from "./commands"
import {Map} from "./map"
import {RangeStore, MarkedRange} from "./range"

export default class ProseMirror {
  constructor(opts) {
    opts = this.options = parseOptions(opts)
    this.content = dom.elt("div", {class: "ProseMirror-content"})
    this.wrapper = dom.elt("div", {class: "ProseMirror"}, this.content)
    this.wrapper.ProseMirror = this
    ensureResizeHandler()

    if (opts.place && opts.place.appendChild)
      opts.place.appendChild(this.wrapper)
    else if (opts.place)
      opts.place(this.wrapper)

    this.doc = opts.doc

    this.ranges = new RangeStore(this)
    draw(this, this.doc)
    this.content.contentEditable = true

    this.mod = Object.create(null)
    this.operation = null
    this.history = new History(this)

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
    return slice.between(this.doc, sel.from, sel.to)
  }

  get selectedText() {
    return text.toText(this.selectedDoc)
  }

  apply(transform, options = nullOptions) {
    if (transform.doc == this.doc) return false

    let sel = this.selection
    this.ranges.transform(transform)
    this.update(transform.doc,
                new Range(transform.map(sel.anchor), transform.map(sel.head)))
    this.signal("transform", transform, options)
    return transform
  }

  get tr() { return new Transform(this.doc) }

  update(doc, sel) {
    if (!sel) {
      let start = Pos.start(doc)
      sel = new Range(start, start)
    }
    this.updateInner(doc, sel)
  }

  updateInner(doc, sel) {
    this.ensureOperation()
    this.doc = doc
    this.sel.set(sel, true)
    this.signal("change")
  }

  setSelection(rangeOrAnchor, head) {
    let range = rangeOrAnchor
    if (!(range instanceof Range))
      range = new Range(rangeOrAnchor, head || rangeOrAnchor)
    this.sel.set(range)
  }

  ensureOperation() {
    if (this.operation) return this.operation
    if (!this.input.suppressPolling) this.sel.poll()
    this.operation = new Operation(this)
    dom.requestAnimationFrame(() => this.endOp())
    return this.operation
  }

  endOp() {
    let op = this.operation
    if (!op || !document.body.contains(this.wrapper)) return
    this.operation = null

    let docChanged = op.doc != this.doc || op.dirty.size
    if (docChanged) {
      if (op.fullRedraw) draw(this, this.doc)
      else redraw(this, op.dirty, this.doc, op.doc)
    }
    if (docChanged || op.sel.anchor.cmp(this.sel.range.anchor) || op.sel.head.cmp(this.sel.range.head))
      this.sel.toDOM(docChanged, op.focus)
    if (op.scrollIntoView !== false)
      scrollIntoView(this, op.scrollIntoView)
    this.signal("draw")
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
    this.ranges.addRange(new MarkedRange(from, to, options))
  }

  extendCommand(name, priority, f) {
    if (f == null) { f = priority; priority = "normal"; }
    if (!/^(normal|low|high)$/.test(priority)) throw new Error("Invalid priority: " + priority)
    this.input.extendCommand(name, priority, f)
  }

  unextendCommand(name, priority, f) {
    if (f == null) { f = priority; priority = "normal"; }
    this.input.unextendCommand(name, priority, f)
  }

  setInlineStyle(st, to, range) {
    if (!range) range = this.selection
    if (!range.empty) {
      if (to == null) to = !inline.rangeHasInlineStyle(this.doc, range.from, range.to, st.type)
      this.apply(this.tr[to ? "addStyle" : "removeStyle"](range.from, range.to, st))
    } else if (!this.doc.path(range.head.path).type.plainText && range == this.selection) {
      let styles = this.input.storedStyles || inline.inlineStylesAt(this.doc, range.head)
      if (to == null) to = !style.contains(styles, st)
      this.input.storedStyles = to ? style.add(styles, st) : style.remove(styles, st)
    }
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
    return coordsAtPos(this, pos)
  }

  scrollIntoView(pos = null) {
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
    this.fullRedraw = false
    this.dirty = new Map
  }
}

function signalResize() {
  let byClass = document.body.getElementsByClassName("ProseMirror")
  for (let i = 0; i < byClass.length; i++) {
    let pm = byClass[i].ProseMirror
    if (!pm) continue
    if (pm) pm.signal("resize")
  }
}

let resizeHandlerRegistered = false
function ensureResizeHandler() {
  if (resizeHandlerRegistered) return
  let resizeTimer = null
  window.addEventListener("resize", () => {
    if (resizeTimer == null) resizeTimer = window.setTimeout(function() {
      resizeTimer = null
      signalResize()
    }, 100)
  })
}
