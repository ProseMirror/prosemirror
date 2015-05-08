import "./editor.css"

import {inline, style, slice, Node, Pos} from "../model"
import {Tr} from "../transform"

import {parseOptions, initOptions, setOption} from "./options"
import {Selection, Range, posAtCoords, coordsAtPos, scrollIntoView, hasFocus} from "./selection"
import * as dom from "./dom"
import {draw, redraw} from "./draw"
import {Input} from "./input"
import {eventMixin} from "./event"
import text from "./text"
import {execCommand} from "./commands"

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

  get selectedDoc() {
    let sel = this.selection
    return slice.between(pm.doc, sel.from, sel.to)
  }

  get selectedText() {
    return text.toText(this.selectedDoc)
  }

  apply(transform) {
    if (transform.doc == this.doc) return false

    let sel = this.selection
    this.update(transform.doc,
                new Range(transform.map(sel.anchor), transform.map(sel.head)))
    this.signal("transform", transform)
    return transform
  }

  get tr() { return Tr(this.doc) }

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

  setSelection(rangeOrAnchor, head) {
    let range = rangeOrAnchor
    if (!(range instanceof Range))
      range = new Range(rangeOrAnchor, head || rangeOrAnchor)
    this.sel.set(range)
  }

  ensureOperation() {
    if (this.operation) return
    if (!this.input.suppressPolling) this.sel.poll()
    this.operation = new Operation(this)
    dom.requestAnimationFrame(() => this.endOp())
  }

  endOp() {
    let op = this.operation
    if (!op || !document.body.contains(this.wrapper)) return
    this.operation = null

    let docChanged = op.doc != this.doc
    if (docChanged) {
      if (op.fullRedraw) draw(this.content, this.doc)
      else redraw(this.content, this.doc, op.doc)
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

  markState() {
    return this.history.markState()
  }

  isInState(state) {
    return this.history.isInState(state)
  }

  backToState(state) {
    return this.history.backToState(state)
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

eventMixin(ProseMirror)

class Operation {
  constructor(pm) {
    this.doc = pm.doc
    this.sel = pm.sel.range
    this.scrollIntoView = false
    this.focus = false
    this.fullRedraw = false
  }
}

class History {
  constructor(pm) {
    this.pm = pm
    this.version = 0
    this.done = []
    this.undone = []
    this.lastAddedAt = 0
    this.nextID = 0
  }

  mark() {
    let now = Date.now()
    if (now > this.lastAddedAt + this.pm.options.historyEventDelay) {
      this.done.push(this.markState())
      while (this.done.length > this.pm.options.historyDepth)
        this.done.shift()
    }
    this.version++
    this.undone.length = 0
    this.lastAddedAt = now
  }

  undo() { this.move(this.done, this.undone) }
  redo() { this.move(this.undone, this.done) }

  move(from, to) {
    var state = from.pop();
    if (state) {
      to.push(this.markState(state.id))
      this.pm.updateInner(state.doc, state.sel)
      this.version = state.version
      this.lastAddedAt = 0
    }
  }

  markState(id) {
    return {doc: this.pm.doc,
            sel: this.pm.selection,
            version: this.version,
            after: this.done.length ? this.done[this.done.length - 1].id : 0,
            id: id || ++this.nextID}
  }

  isInState(state) {
    return this.version == state.version &&
      (state.after ? this.done[this.done.length - 1].id == state.after : this.done.length == 0)
  }

  backToState(state) {
    if (state.after) {
      let found = -1
      for (let i = this.done.length - 1; i >= 0; i--)
        if (this.done[i].id == state.after) { found = i; break }
      if (found == -1) return false
      this.done.length = found + 1
    } else {
      this.done.length = 0
    }
    this.undone.length = 0
    this.pm.update(state.doc, state.sel)
    return true
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
