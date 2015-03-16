import "../css/prosemirror.css"

import {fromText, transform} from "./model"

import * as options from "./options"
import {Selection, Range} from "./selection"
import * as dom from "./dom"
import {draw, redraw} from "./draw"
import {Input} from "./input"
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
    return this.sel.range
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
                       new Range(result.map(sel.anchor), result.map(sel.head)))
      return true
    }
    return false
  }

  updateInner(doc, sel) {
    this.ensureOperation()
    this.doc = doc
    this.setSelection(sel)
  }

  setSelection(range) {
    this.ensureOperation()
    this.sel.set(range)
  }

  ensureOperation() {
    if (this.operation) return
    this.sel.poll()
    this.operation = {doc: this.doc, sel: this.sel.range}
    dom.requestAnimationFrame(() => this.endOp())
  }

  endOp() {
    let op = this.operation
    if (!op) return
    this.operation = null
    let docChanged = op.doc != this.doc
    if (docChanged)
      redraw(this.content, this.doc, op.doc)
    if (docChanged || op.sel.anchor.cmp(this.sel.range.anchor) || op.sel.head.cmp(this.sel.range.head))
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

  markState(includeSelection) {
    return {doc: this.doc, sel: includeSelection && this.selection}
  }

  isInState(state) {
    return state.doc == this.doc && (!state.sel || state.sel == this.selection)
  }

  backToState(state) {
    if (!state.sel) throw new Error("Can only return to a state that includes selection")
    this.updateInner(state.doc, state.sel)
  }
}

eventMixin(ProseMirror)

class State {
  constructor(doc, sel) { this.doc = doc; this.sel = sel }
}

class History {
  constructor(pm) {
    this.pm = pm
    this.done = []
    this.undone = []
    this.lastAddedAt = 0
  }

  mark() {
    let now = Date.now()
    if (now > this.lastAddedAt + this.pm.options.historyEventDelay) {
      this.done.push(pm.markState(true))
      this.undone.length = 0
      while (this.done.length > this.pm.options.historyDepth)
        this.done.shift()
    }
    this.lastAddedAt = now
  }

  undo() { this.move(this.done, this.undone) }
  redo() { this.move(this.undone, this.done) }

  move(from, to) {
    var state = from.pop();
    if (state) {
      to.push(pm.markState(true))
      this.pm.backToState(state)
      this.lastAddedAt = 0
    }
  }
}
