import {fromDOM, toDOM, Pos, Node} from "../model"

import * as keys from "./keys"
import {mac, addClass, rmClass} from "./dom"
import {execCommand} from "./commands"
import {applyDOMChange} from "./domchange"
import text from "./text"
import {Range} from "./selection"

let stopSeq = null
const handlers = {}

export class Input {
  constructor(pm) {
    this.pm = pm

    this.keySeq = null
    this.composing = null
    this.composeActive = 0

    this.draggingFrom = false

    this.keymaps = []
    this.commandExtensions = Object.create(null)

    this.storedStyles = null
    this.storedStylesAt = null

    for (let event in handlers) {
      let handler = handlers[event]
      pm.content.addEventListener(event, (e) => handler(pm, e))
    }
  }

  get storedInlineStyles() {
    if (this.storedStyles && !this.pm.isInState(this.storedStylesAt))
      this.storedStyles = null
    return this.storedStyles
  }

  storeInlineStyle(styles) {
    this.storedStyles = styles
    this.storedStylesAt = this.pm.markState(true)
  }

  extendCommand(name, priority, f) {
    let obj = this.commandExtensions[name] ||
        (this.commandExtensions[name] = {low: [], normal: [], high: []})
    obj[priority].push(f)
  }

  unextendCommand(name, priority, f) {
    let obj = this.commandExtensions[name]
    let arr = obj && obj[priority]
    if (arr) for (let i = 0; i < arr.length; i++)
      if (arr[i] == f) { arr.splice(i, 1); break }
  }
}

function dispatchKey(pm, name, e) {
  let seq = pm.input.keySeq
  if (seq) {
    if (keys.isModifierKey(name)) return true
    clearTimeout(stopSeq)
    stopSeq = setTimeout(function() {
      if (pm.input.keySeq == seq)
        pm.input.keySeq = null
    }, 50)
    name = seq + " " + name
  }

  let handle = function(bound) {
    let result = typeof bound == "string" ? execCommand(pm, bound) : bound(pm)
    return result !== false
  }

  let result
  for (let i = 0; !result && i < pm.input.keymaps.length; i++)
    result = keys.lookupKey(name, pm.input.keymaps[i], handle, pm)
  if (!result)
    result = keys.lookupKey(name, pm.options.extraKeymap, handle, pm) ||
      keys.lookupKey(name, pm.options.keymap, handle, pm)

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
  let name = keys.keyName(e)
  if (name) dispatchKey(pm, name, e)
}

function inputText(pm, range, text) {
  if (range.empty && !text) return false
  pm.apply({name: "replace", pos: range.from, end: range.to,
            text: text, styles: pm.input.storedInlineStyles})
  pm.signal("textInput", text)
  pm.scrollIntoView()
}

handlers.keypress = (pm, e) => {
  if (!e.charCode || e.ctrlKey && !e.altKey || mac && e.metaKey) return
  let ch = String.fromCharCode(e.charCode)
  if (dispatchKey(pm, "'" + ch + "'", e)) return
  inputText(pm, pm.selection, ch)
  e.preventDefault()
}

handlers.compositionstart = (pm, e) => {
  let data = e.data
  pm.input.composing = {sel: pm.selection,
                        data: data,
                        startData: data}
  pm.input.composeActive++
  // FIXME set selection around existing data if applicable
}

handlers.compositionupdate = (pm, e) => {
  pm.input.composing.data = e.data
}

handlers.compositionend = (pm, e) => {
  let info = pm.input.composing
  if (!info) return
  pm.input.composing = null
  if (e.data != info.startData && !/\u200b/.test(e.data))
    info.data = e.data
  applyComposition(pm, info)
  // Disable input events for a short time more
  setTimeout((() => pm.input.composeActive--), 50)
}

function applyComposition(pm, info) {
  inputText(pm, info.sel, info.data)
}

handlers.input = (pm) => {
  if (pm.input.composeActive) return
  pm.input.suppressPolling = true
  applyDOMChange(pm)
  pm.input.suppressPolling = false
  pm.sel.poll(true)
  pm.scrollIntoView()
}

let lastCopied = null

handlers.copy = handlers.cut = (pm, e) => {
  let sel = pm.selection
  if (sel.empty) return
  let elt = document.createElement("div")
  let fragment = pm.selectedDoc
  elt.appendChild(toDOM(fragment, {document: document}))
  lastCopied = {doc: pm.doc, from: sel.from, to: sel.to,
                html: elt.innerHTML, text: text.toText(fragment)}

  if (e.clipboardData) {
    e.preventDefault()
    e.clipboardData.clearData()
    e.clipboardData.setData("text/html", lastCopied.html)
    e.clipboardData.setData("text/plain", lastCopied.text)
    if (e.type == "cut" && !sel.empty)
      pm.apply({name: "replace", pos: sel.from, end: sel.to})
  }
}

// FIXME support markup-less form of paste when shift is held

handlers.paste = (pm, e) => {
  if (!e.clipboardData) return
  let sel = pm.selection
  let html = e.clipboardData.getData("text/html")
  let txt = e.clipboardData.getData("text/plain")
  if (html || txt) {
    e.preventDefault()
    let doc, from, to
    if (lastCopied && (lastCopied.html == html || lastCopied.text == txt)) {
      ({doc, from, to}) = lastCopied
    } else if (html) {
      let elt = document.createElement("div")
      elt.innerHTML = html
      doc = fromDOM(elt)
    } else {
      doc = (text.fromMarkdown || text.fromText)(txt)
    }
    pm.apply({name: "replace", pos: sel.from, end: sel.to,
              source: doc, from: from || Pos.start(doc), to: to || Pos.end(doc)})
    pm.scrollIntoView()
  }
}

handlers.dragstart = (pm, e) => {
  if (!e.dataTransfer) return

  let sel = pm.selection
  let elt = document.createElement("div")
  let fragment = pm.selectedDoc
  elt.appendChild(toDOM(fragment, {document: document}))

  e.dataTransfer.setData("text/html", elt.innerHTML)
  e.dataTransfer.setData("text/plain", text.toText(fragment) + "??")
  pm.input.draggingFrom = true
}

handlers.dragend = pm => window.setTimeout(() => pm.input.dragginFrom = false, 50)

handlers.dragover = handlers.dragenter = (_, e) => e.preventDefault()

handlers.drop = (pm, e) => {
  if (!e.dataTransfer) return

  let html, txt, doc
  if (html = e.dataTransfer.getData("text/html")) {
    let elt = document.createElement("div")
    elt.innerHTML = html
    doc = fromDOM(elt)
  } else if (txt = e.dataTransfer.getData("text/plain")) {
    doc = (text.fromMarkdown || text.fromText)(txt)
  }
  if (doc) {
    e.preventDefault()
    let insertPos = pm.posAtCoords({left: e.clientX, top: e.clientY})
    if (pm.input.draggingFrom && !e.ctrlKey) {
      let sel = pm.selection
      let result = pm.apply({name: "replace", pos: sel.from, end: sel.to})
      insertPos = result.map(insertPos)
    }
    let result = pm.apply({name: "replace", pos: insertPos,
                           source: doc, from: Pos.start(doc), to: Pos.end(doc)})
    pm.setSelection(new Range(insertPos, result.map(insertPos)))
    pm.focus()
  }
}

handlers.focus = pm => {
  addClass(pm.wrapper, "ProseMirror-focused")
  pm.signal("focus")
}

handlers.blur = pm => {
  rmClass(pm.wrapper, "ProseMirror-focused")
  pm.signal("blur")
}
