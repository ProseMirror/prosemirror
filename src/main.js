import "../css/prosemirror.css"

import {fromText, transform} from "./model"

import * as options from "./options"
import {Selection} from "./selection"
import * as dom from "./dom"
import {draw, redraw} from "./draw"
import {Input} from "./input"
import History from "./history"
import {initModules} from "./module"
import {eventMixin} from "./event"

export default class ProseMirror {
  constructor(opts) {
    opts = this.options = options.init(opts)
    this.wrapper = this.content = dom.elt("div", {class: "ProseMirror"})
    if (opts.place && opts.place.appendChild)
      opts.place.appendChild(this.wrapper)
    else if (opts.place)
      opts.place(this.wrapper)

    this.doc = typeof opts.value == "string" ? fromText(opts.value) : opts.value

    draw(this.content, this.doc)
    this.content.contentEditable = true

    this.modules = Object.create(null)
    this.operation = null
    this.history = new History(this)

    this.sel = new Selection(this)
    this.input = new Input(this)
    initModules(this, this.options.modules)
  }

  get selection() {
    this.ensureOperation()
    return this.sel.value
  }

  get value() {
    return this.doc
  }


  apply(params) {
    let sel = this.selection
    let result = transform.apply(this.doc, params)
    if (result.doc != this.doc) {
      this.history.mark()
      this.updateInner(result.doc,
                       result.map(sel.anchor),
                       result.map(sel.head))
      return true
    }
    return false
  }

  updateInner(doc, selAnchor, selHead) {
    this.ensureOperation()
    this.doc = doc
    this.setSelection(selAnchor, selHead)
  }

  setSelection(anchor, head) {
    this.ensureOperation()
    this.sel.set(anchor, head)
  }

  ensureOperation() {
    if (this.operation) return
    this.sel.poll()
    this.operation = {doc: this.doc, sel: this.sel.value}
    dom.requestAnimationFrame(() => this.update())
  }

  update() {
    let op = this.operation
    if (!op) return
    this.operation = null
    let docChanged = op.doc != this.doc
    if (docChanged)
      redraw(this.content, this.doc, op.doc)
    if (docChanged || op.sel.anchor.cmp(this.sel.value.anchor) || op.sel.head.cmp(this.sel.value.head))
      this.sel.toDOM(docChanged)
  }

  addKeymap(map, bottom) {
    this.keymaps[bottom ? "push" : "unshift"](map)
  }

  removeKeymap(map) {
    let maps = this.keymaps
    for (let i = 0; i < maps.length; ++i) if (maps[i] == map || maps[i].name == map) {
      maps.splice(i, 1)
      return true
    }
  }

  extendCommand(name, priority, f) {
    if (f == null) { f = priority; priority = "normal"; }
    if (!/^(normal|low|high)$/.test(priority)) throw new Error("Invalid priority: " + priority)
    this.input.extendCommand(name, priority, f)
  }
}

eventMixin(ProseMirror)
