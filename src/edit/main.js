import "./editor.css"

import {transform, inline, style, Node, Pos} from "../model"

import {parseOptions, initOptions} from "./options"
import {Selection, Range, posFromCoords, hasFocus} from "./selection"
import * as dom from "./dom"
import {draw, redraw} from "./draw"
import {Input} from "./input"
import {eventMixin} from "./event"

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

    draw(this.content, this.doc)
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

  apply(params) {
    let sel = this.selection
    let result = transform.apply(this.doc, params)
    if (result.doc != this.doc) {
      this.update(result.doc,
                  new Range(result.map(sel.anchor), result.map(sel.head)))
      this.signal("transform", params)
      return result
    }
    return false
  }

  update(doc, sel) {
    this.history.mark()
    if (!sel) {
      let start = Pos.start(doc)
      sel = new Range(start, start)
    }
    this.updateInner(doc, sel)
  }

  updateInner(doc, sel) {
    this.ensureOperation()
    this.doc = doc
    this.setSelection(sel)
    this.signal("change")
  }

  setSelection(range) {
    this.sel.set(range)
  }

  ensureOperation() {
    if (this.operation) return
    if (!this.input.suppressPolling) this.sel.poll()
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
    this.signal("draw")
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

  unextendCommand(name, priority, f) {
    if (f == null) { f = priority; priority = "normal"; }
    this.input.unextendCommand(name, priority, f)
  }

  markState(includeSelection) {
    return {doc: this.doc, sel: includeSelection && this.selection}
  }

  isInState(state) {
    return state.doc == this.doc && (!state.sel || state.sel == this.selection)
  }

  backToState(state) {
    if (!state.sel) throw new Error("Can only return to a state that includes selection")
    this.update(state.doc, state.sel)
  }

  setInlineStyle(st, to, range) {
    if (!range) range = this.selection
    if (!range.empty) {
      if (to == null) to = !inline.rangeHasInlineStyle(this.doc, range.from, range.to, st.type)
      this.apply({name: to ? "addStyle" : "removeStyle",
                  pos: range.from, end: range.to, style: st})
    } else if (this.doc.path(range.head.path).type != Node.types.code_block) {
      let styles = this.input.storedInlineStyle || inline.inlineStylesAt(this.doc, range.head)
      if (to == null) to = !style.contains(styles, st)
      this.input.storeInlineStyle(to ? style.add(styles, st) : style.remove(styles, st))
    }
  }

  focus() {
    this.content.focus()
    this.sel.toDOM()
  }

  hasFocus() {
    return hasFocus(this)
  }

  posUnder(coords) {
    return posFromCoords(this, coords)
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
      this.pm.updateInner(state.doc, state.sel)
      this.lastAddedAt = 0
    }
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
