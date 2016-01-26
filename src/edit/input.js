import Keymap from "browserkeymap"
import {Pos} from "../model"
import {knownSource, parseFrom, fromHTML, fromText, toHTML, toText} from "../format"
import {elt} from "../dom"

import {captureKeys} from "./capturekeys"
import {browser, addClass, rmClass} from "../dom"
import {applyDOMChange, textContext, textInContext} from "./domchange"
import {TextSelection, coordsAtPos, rangeFromDOMLoose, selectableNodeAbove,
        findSelectionAtStart, findSelectionAtEnd, handleNodeClick, posFromDOM} from "./selection"

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
        let sel = getSelection()
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
  if (e.keyCode == 16) pm.input.shiftKey = true
  if (pm.input.composing) return
  let name = Keymap.keyName(e)
  if (name && dispatchKey(pm, name, e)) return
  pm.sel.pollForUpdate()
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
  if (dispatchKey(pm, Keymap.keyName(e))) return
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
  if (!pos) return pm.sel.pollForUpdate()

  let {node, from} = pm.selection
  if (node && pos.depth >= from.depth && pos.shorten(from.depth).cmp(from) == 0) {
    if (from.depth == 0) return pm.sel.pollForUpdate()
    pos = from.shorten()
  }

  pm.setNodeSelection(pos)
  pm.focus()
  e.preventDefault()
}

let lastClick = 0, oneButLastClick = 0

handlers.mousedown = (pm, e) => {
  pm.sel.pollForUpdate()

  let now = Date.now(), doubleClick = now - lastClick < 500, tripleClick = now - oneButLastClick < 600
  oneButLastClick = lastClick
  lastClick = now
  if (tripleClick) {
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
    return
  }
  let leaveToBrowser = pm.input.shiftKey || doubleClick

  let x = e.clientX, y = e.clientY
  let up = () => {
    removeEventListener("mouseup", up)
    removeEventListener("mousemove", move)

    if (leaveToBrowser) {
      pm.sel.pollForUpdate()
    } else if (e.ctrlKey) {
      selectClickedNode(pm, e)
    } else if (!handleNodeClick(pm, "handleClick", e, true)) {
      let pos = selectableNodeAbove(pm, e.target, {left: e.clientX, top: e.clientY})
      if (pos) {
        pm.setNodeSelection(pos)
        pm.focus()
      } else {
        pm.sel.pollForUpdate()
      }
    }
  }
  let move = e => {
    if (!leaveToBrowser && (Math.abs(x - e.clientX) > 4 || Math.abs(y - e.clientY) > 4))
      leaveToBrowser = true
    pm.sel.pollForUpdate()
  }
  addEventListener("mouseup", up)
  addEventListener("mousemove", move)
}

handlers.touchdown = pm => {
  pm.sel.pollForUpdate()
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

  pm.sel.stopPollingForUpdate()
  applyDOMChange(pm)
  pm.scrollIntoView()
}

let lastCopied = null

function setCopied(doc, from, to, dataTransfer) {
  let fragment = doc.sliceBetween(from, to)
  lastCopied = {doc, from, to,
                schema: doc.type.schema,
                html: toHTML(fragment),
                text: toText(fragment)}
  if (dataTransfer) {
    dataTransfer.clearData()
    dataTransfer.setData("text/html", lastCopied.html)
    dataTransfer.setData("text/plain", lastCopied.text)
  }
}

function getCopied(pm, dataTransfer, plainText) {
  let txt = dataTransfer.getData("text/plain")
  let html = dataTransfer.getData("text/html")
  if (!html && !txt) return null
  let doc
  if (plainText && txt) {
    doc = fromText(pm.schema, pm.signalPipelined("transformPastedText", txt))
  } else if (lastCopied && lastCopied.html == html && lastCopied.schema == pm.schema) {
    return lastCopied
  } else if (html) {
    doc = fromHTML(pm.schema, pm.signalPipelined("transformPastedHTML", html))
  } else {
    doc = parseFrom(pm.schema, pm.signalPipelined("transformPastedText", txt),
                    knownSource("markdown") ? "markdown" : "text")
  }
  return {doc, from: findSelectionAtStart(doc).from, to: findSelectionAtEnd(doc).to}
}

handlers.copy = handlers.cut = (pm, e) => {
  let {from, to, empty} = pm.selection
  if (empty) return
  setCopied(pm.doc, from, to, e.clipboardData)
  if (e.clipboardData) {
    e.preventDefault()
    if (e.type == "cut" && !empty)
      pm.tr.delete(from, to).apply()
  }
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
  let fragment = getCopied(pm, e.clipboardData, pm.input.shiftKey)
  if (fragment) {
    e.preventDefault()
    pm.tr.replace(sel.from, sel.to, fragment.doc, fragment.from, fragment.to).apply()
    pm.scrollIntoView()
  }
}

handlers.dragstart = (pm, e) => {
  if (!e.dataTransfer) return

  let {from, to, empty} = pm.selection, fragment
  let pos = !empty && pm.posAtCoords({left: e.clientX, top: e.clientY})
  if (pos && pos.cmp(from) >= 0 && pos.cmp(to) <= 0) {
    fragment = {from, to}
  } else {
    let pos = posFromDOM(pm, e.target)
    let node = pm.doc.nodeAfter(pos)
    if (node && node.type.draggable)
      fragment = {from: pos, to: pos.move(1)}
  }

  if (fragment) {
    pm.input.draggingFrom = fragment
    setCopied(pm.doc, fragment.from, fragment.to, e.dataTransfer)
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

  if (!e.dataTransfer) return

  let fragment = getCopied(pm, e.dataTransfer)
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
  addClass(pm.wrapper, "ProseMirror-focused")
  // :: () #path=ProseMirror#events#focus
  // Fired when the editor gains focus.
  pm.signal("focus")
}

handlers.blur = pm => {
  rmClass(pm.wrapper, "ProseMirror-focused")
  // :: () #path=ProseMirror#events#blur
  // Fired when the editor loses focus.
  pm.signal("blur")
}
