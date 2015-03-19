import {fromDOM, toDOM, Pos, Node, slice} from "../model"

import * as keys from "./keys"
import * as dom from "./dom"
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
        pm.input.keySeq = null;
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
}

handlers.keypress = (pm, e) => {
  if (e.ctrlKey && !e.altKey || dom.mac && e.metaKey) return
  let ch = String.fromCharCode(e.charCode == null ? e.keyCode : e.charCode)
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
  pm.input.composing.data = e.data;
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
  pm.sel.poll()
}

let lastCopied = null

handlers.copy = handlers.cut = (pm, e) => {
  let sel = pm.selection
  if (sel.empty) return
  let elt = document.createElement("div")
  let fragment = slice.between(pm.doc, sel.from, sel.to)
  elt.appendChild(toDOM(fragment, {document: document}))
  lastCopied = {doc: pm.doc, from: sel.from, to: sel.to,
                html: elt.innerHTML, text: text.toText(fragment)}

  if (e.clipboardData) {
    e.preventDefault()
    e.clipboardData.clearData()
    e.clipboardData.setData("text/html", lastCopied.html)
    e.clipboardData.setData("text/plain", lastCopied.text);
    if (e.type == "cut" && !sel.empty)
      pm.apply({name: "replace", pos: sel.from, end: sel.to})
  }
}

handlers.paste = (pm, e) => {
  if (!e.clipboardData) return
  let sel = pm.selection
  let html = e.clipboardData.getData("text/html")
  let text = e.clipboardData.getData("text/plain")
  if (html || text) {
    e.preventDefault()
    let doc, from, to
    if (lastCopied && (lastCopied.html == html || lastCopied.text == text)) {
      ({doc, from, to}) = lastCopied
    } else if (html) {
      let elt = document.createElement("div")
      elt.innerHTML = html
      doc = fromDOM(elt)
    } else {
      doc = (text.fromMarkdown || text.fromText)(text)
    }
    pm.apply({name: "replace", pos: sel.from, end: sel.to,
              source: doc, from: from || Pos.start(doc), to: to || Pos.end(doc)})
  }
}

handlers.dragstart = (pm, e) => {
  if (!e.dataTransfer) return

  let sel = pm.selection
  let elt = document.createElement("div")
  let fragment = slice.between(pm.doc, sel.from, sel.to)
  elt.appendChild(toDOM(fragment, {document: document}))

  e.dataTransfer.setData("text/html", elt.innerHTML)
  e.dataTransfer.setData("text/plain", text.toText(fragment) + "??")
}

handlers.dragover = handlers.dragenter = (_, e) => e.preventDefault()

handlers.drop = (pm, e) => {
  if (!e.dataTransfer) return

  let html, text, doc
  if (html = e.dataTransfer.getData("text/html")) {
    let elt = document.createElement("div")
    elt.innerHTML = html
    doc = fromDOM(elt)
  } else if (text = e.dataTransfer.getData("text/plain")) {
    doc = (text.fromMarkdown || text.fromText)(text)
  }
  if (doc) {
    e.preventDefault()
    if (!e.ctrlKey) {
      let sel = pm.selection
      pm.apply({name: "replace", pos: sel.from, end: sel.to})
    }
    let insertPos = pm.posUnder({left: e.clientX, top: e.clientY})
    let result = pm.apply({name: "replace", pos: insertPos,
                           source: doc, from: Pos.start(doc), to: Pos.end(doc)})
    pm.setSelection(new Range(insertPos, result.map(insertPos)))
  }
}
