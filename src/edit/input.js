import Keymap from "browserkeymap"
import {Pos} from "../model"
import {parseFrom, fromDOM, toHTML, toText} from "../format"

import {captureKeys} from "./capturekeys"
import {elt, browser} from "../dom"

import {applyDOMChange, textContext, textInContext} from "./domchange"
import {TextSelection, rangeFromDOMLoose, findSelectionAtStart, findSelectionAtEnd} from "./selection"
import {coordsAtPos, pathFromDOM, handleNodeClick, selectableNodeAbove} from "./dompos"

let stopSeq = null

// A collection of DOM events that occur within the editor, and callback functions
// to invoke when the event fires.
const handlers = {}

export class Input {
  constructor(pm) {
    this.pm = pm
    this.baseKeymap = null

    this.keySeq = null

    // When the user is creating a composed character,
    // this is set to a Composing instance.
    this.composing = null
    this.mouseDown = null
    this.shiftKey = this.updatingComposition = false
    this.skipInput = 0

    this.draggingFrom = false

    this.keymaps = []
    this.defaultKeymap = null

    this.storedMarks = null

    this.dropTarget = pm.wrapper.appendChild(elt("div", {class: "ProseMirror-drop-target"}))

    for (let event in handlers) {
      let handler = handlers[event]
      pm.content.addEventListener(event, e => handler(pm, e))
    }

    pm.on("selectionChange", () => this.storedMarks = null)
  }

  maybeAbortComposition() {
    if (this.composing && !this.updatingComposition) {
      if (this.composing.finished) {
        finishComposing(this.pm)
      } else { // Toggle selection to force end of composition
        this.composing = null
        this.skipInput++
        let sel = window.getSelection()
        if (sel.rangeCount) {
          let range = sel.getRangeAt(0)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }
      return true
    }
  }
}

// Dispatch a key press to the internal keymaps, which will override the default
// DOM behavior.
export function dispatchKey(pm, name, e) {
  let seq = pm.input.keySeq
  // If the previous key should be used in sequence with this one, modify the name accordingly.
  if (seq) {
    if (Keymap.isModifierKey(name)) return true
    clearTimeout(stopSeq)
    stopSeq = setTimeout(function() {
      if (pm.input.keySeq == seq)
        pm.input.keySeq = null
    }, 50)
    name = seq + " " + name
  }

  let handle = function(bound) {
    if (bound === false) return "nothing"
    if (bound == "...") return "multi"
    if (bound == null) return false

    let result = false
    if (Array.isArray(bound)) {
      for (let i = 0; result === false && i < bound.length; i++)
        result = handle(bound[i])
    } else if (typeof bound == "string") {
      result = pm.execCommand(bound)
    } else {
      result = bound(pm)
    }
    return result == false ? false : "handled"
  }

  let result
  for (let i = 0; !result && i < pm.input.keymaps.length; i++)
    result = handle(pm.input.keymaps[i].map.lookup(name, pm))
  if (!result)
    result = handle(pm.input.baseKeymap.lookup(name, pm)) || handle(captureKeys.lookup(name))

  // If the key should be used in sequence with the next key, store the keyname internally.
  if (result == "multi")
    pm.input.keySeq = name

  if (result == "handled" || result == "multi")
    e.preventDefault()

  if (seq && !result && /\'$/.test(name)) {
    e.preventDefault()
    return true
  }
  return !!result
}

handlers.keydown = (pm, e) => {
  // :: () #path=ProseMirror#events#interaction
  // Fired when the user interacts with the editor, for example by
  // clicking on it or pressing a key while it is focused. Mostly
  // useful for closing or resetting transient UI state such as open
  // menus.
  pm.signal("interaction")
  if (e.keyCode == 16) pm.input.shiftKey = true
  if (pm.input.composing) return
  let name = Keymap.keyName(e)
  if (name && dispatchKey(pm, name, e)) return
  pm.sel.fastPoll()
}

handlers.keyup = (pm, e) => {
  if (e.keyCode == 16) pm.input.shiftKey = false
}

// : (ProseMirror, TextSelection, string)
// Insert text into a document.
function inputText(pm, range, text) {
  if (range.empty && !text) return false
  let marks = pm.input.storedMarks || pm.doc.marksAt(range.from)
  pm.tr.replaceWith(range.from, range.to, pm.schema.text(text, marks)).apply({scrollIntoView: true})
  // :: () #path=ProseMirror#events#textInput
  // Fired when the user types text into the editor.
  pm.signal("textInput", text)
}

handlers.keypress = (pm, e) => {
  if (pm.input.composing || !e.charCode || e.ctrlKey && !e.altKey || browser.mac && e.metaKey) return
  if (dispatchKey(pm, Keymap.keyName(e), e)) return
  let sel = pm.selection
  if (sel.node && sel.node.contains == null) {
    pm.tr.delete(sel.from, sel.to).apply()
    sel = pm.selection
  }
  inputText(pm, sel, String.fromCharCode(e.charCode))
  e.preventDefault()
}

function selectClickedNode(pm, e) {
  let pos = selectableNodeAbove(pm, e.target, {left: e.clientX, top: e.clientY}, true)
  if (!pos) return pm.sel.fastPoll()

  let {node, from} = pm.selection
  if (node && pos.depth >= from.depth && pos.shorten(from.depth).cmp(from) == 0) {
    if (from.depth == 0) return pm.sel.fastPoll()
    pos = from.shorten()
  }

  pm.setNodeSelection(pos)
  pm.focus()
  e.preventDefault()
}

let lastClick = 0, oneButLastClick = 0

function handleTripleClick(pm, e) {
  e.preventDefault()
  let pos = selectableNodeAbove(pm, e.target, {left: e.clientX, top: e.clientY}, true)
  if (pos) {
    let node = pm.doc.nodeAfter(pos)
    if (node.isBlock && !node.isTextblock) {
      pm.setNodeSelection(pos)
    } else {
      let path = node.isInline ? pos.path : pos.toPath()
      if (node.isInline) node = pm.doc.path(path)
      pm.setTextSelection(new Pos(path, 0), new Pos(path, node.size))
    }
    pm.focus()
  }
}

handlers.mousedown = (pm, e) => {
  pm.signal("interaction")
  let now = Date.now(), doubleClick = now - lastClick < 500, tripleClick = now - oneButLastClick < 600
  oneButLastClick = lastClick
  lastClick = now

  if (tripleClick) handleTripleClick(pm, e)
  else pm.input.mouseDown = new MouseDown(pm, e, doubleClick)
}

class MouseDown {
  constructor(pm, event, doubleClick) {
    this.pm = pm
    this.event = event
    this.leaveToBrowser = pm.input.shiftKey || doubleClick

    let path = pathFromDOM(pm, event.target), node = pm.doc.path(path)
    this.mightDrag = node.type.draggable || node == pm.sel.range.node ? path : null
    if (this.mightDrag) {
      event.target.draggable = true
      if (browser.gecko && (this.setContentEditable = !event.target.hasAttribute("contentEditable")))
        event.target.setAttribute("contentEditable", "false")
    }

    this.x = event.clientX; this.y = event.clientY

    window.addEventListener("mouseup", this.up = this.up.bind(this))
    window.addEventListener("mousemove", this.move = this.move.bind(this))
    pm.sel.fastPoll()
  }

  done() {
    window.removeEventListener("mouseup", this.up)
    window.removeEventListener("mousemove", this.move)
    if (this.mightDrag) {
      this.event.target.draggable = false
      if (browser.gecko && this.setContentEditable)
        this.event.target.removeAttribute("contentEditable")
    }
  }

  up() {
    this.done()

    if (this.leaveToBrowser) {
      this.pm.sel.fastPoll()
    } else if (this.event.ctrlKey) {
      selectClickedNode(this.pm, this.event)
    } else if (!handleNodeClick(this.pm, "handleClick", this.event, true)) {
      let pos = selectableNodeAbove(this.pm, this.event.target, {left: this.x, top: this.y})
      if (pos) {
        this.pm.setNodeSelection(pos)
        this.pm.focus()
      } else {
        this.pm.sel.fastPoll()
      }
    }
  }

  move(event) {
    if (!this.leaveToBrowser && (Math.abs(this.x - event.clientX) > 4 ||
                                 Math.abs(this.y - event.clientY) > 4))
      this.leaveToBrowser = true
    this.pm.sel.fastPoll()
  }
}

handlers.touchdown = pm => {
  pm.sel.fastPoll()
}

handlers.contextmenu = (pm, e) => {
  handleNodeClick(pm, "handleContextMenu", e, false)
}

// A class to track state while creating a composed character.
class Composing {
  constructor(pm, data) {
    this.finished = false
    this.context = textContext(data)
    this.data = data
    this.endData = null
    let range = pm.selection
    if (data) {
      let path = range.head.path, line = pm.doc.path(path).textContent
      let found = line.indexOf(data, range.head.offset - data.length)
      if (found > -1 && found <= range.head.offset + data.length)
        range = new TextSelection(new Pos(path, found), new Pos(path, found + data.length))
    }
    this.range = range
  }
}

handlers.compositionstart = (pm, e) => {
  if (pm.input.maybeAbortComposition()) return

  pm.flush()
  pm.input.composing = new Composing(pm, e.data)
  let above = pm.selection.head.shorten()
  pm.markRangeDirty({from: above, to: above.move(1)})
}

handlers.compositionupdate = (pm, e) => {
  let info = pm.input.composing
  if (info && info.data != e.data) {
    info.data = e.data
    pm.input.updatingComposition = true
    inputText(pm, info.range, info.data)
    pm.input.updatingComposition = false
    info.range = new TextSelection(info.range.from, info.range.from.move(info.data.length))
  }
}

handlers.compositionend = (pm, e) => {
  let info = pm.input.composing
  if (info) {
    pm.input.composing.finished = true
    pm.input.composing.endData = e.data
    setTimeout(() => {if (pm.input.composing == info) finishComposing(pm)}, 20)
  }
}

function finishComposing(pm) {
  let info = pm.input.composing
  let text = textInContext(info.context, info.endData)
  let range = rangeFromDOMLoose(pm)
  pm.ensureOperation()
  pm.input.composing = null
  if (text != info.data) inputText(pm, info.range, text)
  if (range && !range.eq(pm.sel.range)) pm.setSelectionDirect(range)
}

handlers.input = (pm) => {
  if (pm.input.skipInput) return --pm.input.skipInput

  if (pm.input.composing) {
    if (pm.input.composing.finished) finishComposing(pm)
    return
  }

  pm.startOperation({readSelection: false})
  applyDOMChange(pm)
  pm.scrollIntoView()
}

function toClipboard(doc, from, to, dataTransfer) {
  let found
  for (let depth = 0, node = doc.sliceBetween(from, to);; depth++) {
    if (node.type.defaultAttrs) found = {depth, node}
    if (node.size > 1) break
    node = node.firstChild
  }

  let attr = `${found.node.type.name} ${from.depth - found.depth} ${to.depth - found.depth}`
  let html = `<div pm-context="${attr}">${toHTML(found.node)}</div>`
  dataTransfer.clearData()
  dataTransfer.setData("text/html", html)
  dataTransfer.setData("text/plain", toText(found.node))
}

function fromClipboard(pm, dataTransfer, plainText) {
  let txt = dataTransfer.getData("text/plain")
  let html = dataTransfer.getData("text/html")
  if (!html && !txt) return null
  let doc, from, to
  if ((plainText || !html) && txt) {
    doc = parseFrom(pm.schema, pm.signalPipelined("transformPastedText", txt), "text")
  } else {
    let dom = document.createElement("div")
    dom.innerHTML = pm.signalPipelined("transformPastedHTML", html)
    let wrap = dom.querySelector("[pm-context]"), context, contextNode, found
    if (wrap && (context = /^(\w+) (\d+) (\d+)$/.exec(wrap.getAttribute("pm-context"))) &&
        (contextNode = pm.schema.nodes[context[1]]) && contextNode.defaultAttrs &&
        (found = parseFromContext(wrap, contextNode, +context[2], +context[3]))) {
      ;({doc, from, to} = found)
    } else {
      doc = fromDOM(pm.schema, dom)
    }
  }
  return {doc,
          from: from || findSelectionAtStart(doc).from,
          to: to || findSelectionAtEnd(doc).to}
}

function posAtLeft(doc, depth) {
  let path = []
  for (let i = 0, node = doc; i < depth; i++) {
    if (!(node = node.firstChild)) break
    path.push(0)
  }
  return new Pos(path, 0)
}

function posAtRight(doc, depth) {
  let path = [], node = doc
  for (let i = 0; i < depth; i++) {
    if (!node.size) break
    path.push(node.size - 1)
    node = node.lastChild
  }
  return new Pos(path, node.size)
}

function parseFromContext(dom, contextNode, openLeft, openRight) {
  let schema = contextNode.schema, top = schema.nodes.doc
  let doc = fromDOM(schema, dom, {topNode: contextNode.create()})
  if (contextNode != top) {
    let path = top.findConnection(contextNode)
    if (!path) return null
    for (let i = path.length - 1; i >= -1; i--) {
      doc = (i < 0 ? top : path[i]).create(null, doc)
      ++openLeft
      ++openRight
    }
  }
  return {doc, from: posAtLeft(doc, openLeft), to: posAtRight(doc, openRight)}
}

handlers.copy = handlers.cut = (pm, e) => {
  let {from, to, empty} = pm.selection
  if (empty || !e.clipboardData) return
  toClipboard(pm.doc, from, to, e.clipboardData)
  e.preventDefault()
  if (e.type == "cut" && !empty)
    pm.tr.delete(from, to).apply()
}

// :: (text: string) → string #path=ProseMirror#events#transformPastedText
// Fired when plain text is pasted. Handlers must return the given
// string or a [transformed](#EventMixin.signalPipelined) version of
// it.

// :: (html: string) → string #path=ProseMirror#events#transformPastedHTML
// Fired when html content is pasted. Handlers must return the given
// string or a [transformed](#EventMixin.signalPipelined) version of
// it.

handlers.paste = (pm, e) => {
  if (!e.clipboardData) return
  let sel = pm.selection
  let fragment = fromClipboard(pm, e.clipboardData, pm.input.shiftKey)
  if (fragment) {
    e.preventDefault()
    pm.tr.replace(sel.from, sel.to, fragment.doc, fragment.from, fragment.to).apply()
    pm.scrollIntoView()
  }
}

handlers.dragstart = (pm, e) => {
  let mouseDown = pm.input.mouseDown
  if (mouseDown) mouseDown.done()

  if (!e.dataTransfer) return

  let {from, to, empty} = pm.selection, fragment
  let pos = !empty && pm.posAtCoords({left: e.clientX, top: e.clientY})
  if (pos && pos.cmp(from) >= 0 && pos.cmp(to) <= 0) {
    fragment = {from, to}
  } else if (mouseDown && mouseDown.mightDrag) {
    let pos = Pos.from(mouseDown.mightDrag)
    fragment = {from: pos, to: pos.move(1)}
  }

  if (fragment) {
    // FIXME the document could change during a drag, invalidating this range
    pm.input.draggingFrom = fragment
    toClipboard(pm.doc, fragment.from, fragment.to, e.dataTransfer)
  }
}

handlers.dragend = pm => window.setTimeout(() => pm.input.draggingFrom = false, 50)

handlers.dragover = handlers.dragenter = (pm, e) => {
  e.preventDefault()
  let cursorPos = pm.posAtCoords({left: e.clientX, top: e.clientY})
  if (!cursorPos) return
  let coords = coordsAtPos(pm, cursorPos)
  let rect = pm.wrapper.getBoundingClientRect()
  coords.top -= rect.top
  coords.right -= rect.left
  coords.bottom -= rect.top
  coords.left -= rect.left
  let target = pm.input.dropTarget
  target.style.display = "block"
  target.style.left = (coords.left - 1) + "px"
  target.style.top = coords.top + "px"
  target.style.height = (coords.bottom - coords.top) + "px"
}

handlers.dragleave = pm => pm.input.dropTarget.style.display = ""

handlers.drop = (pm, e) => {
  pm.input.dropTarget.style.display = ""

  // :: (event: DOMEvent) #path=ProseMirror#events#drop
  // Fired when a drop event occurs on the editor content. A handler
  // may declare the event handled by calling `preventDefault` on it
  // or returning a truthy value.
  if (!e.dataTransfer || pm.signalDOM(e)) return

  let fragment = fromClipboard(pm, e.dataTransfer)
  if (fragment) {
    e.preventDefault()
    let insertPos = pm.posAtCoords({left: e.clientX, top: e.clientY}), origPos = insertPos
    if (!insertPos) return
    let tr = pm.tr
    if (pm.input.draggingFrom && !e.ctrlKey) {
      tr.delete(pm.input.draggingFrom.from, pm.input.draggingFrom.to)
      insertPos = tr.map(insertPos).pos
    }
    tr.replace(insertPos, insertPos, fragment.doc, fragment.from, fragment.to).apply()
    let posAfter = tr.map(origPos).pos
    if (Pos.samePath(insertPos.path, posAfter.path) && posAfter.offset == insertPos.offset + 1 &&
        pm.doc.nodeAfter(insertPos).type.selectable)
      pm.setNodeSelection(insertPos)
    else
      pm.setTextSelection(insertPos, posAfter)
    pm.focus()
  }
}

handlers.focus = pm => {
  pm.wrapper.classList.add("ProseMirror-focused")
  // :: () #path=ProseMirror#events#focus
  // Fired when the editor gains focus.
  pm.signal("focus")
}

handlers.blur = pm => {
  pm.wrapper.classList.remove("ProseMirror-focused")
  // :: () #path=ProseMirror#events#blur
  // Fired when the editor loses focus.
  pm.signal("blur")
}
