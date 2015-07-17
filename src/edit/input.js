import {Pos, Node, Span, spanStylesAt} from "../model"

import {fromDOM} from "../convert/from_dom"
import {toDOM} from "../convert/to_dom"
import {toText} from "../convert/to_text"
import {knownSource, convertFrom} from "../convert/convert"

import {isModifierKey, lookupKey, keyName} from "./keys"
import {browser, addClass, rmClass} from "../dom"
import {execCommand} from "./commands"
import {applyDOMChange} from "./domchange"
import {Range} from "./selection"

let stopSeq = null
const handlers = {}

export class Input {
  constructor(pm) {
    this.pm = pm

    this.keySeq = null
    this.composing = null
    this.shiftKey = false
    this.composeActive = 0

    this.draggingFrom = false

    this.keymaps = []
    this.commandExtensions = Object.create(null)

    this.storedStyles = null

    for (let event in handlers) {
      let handler = handlers[event]
      pm.content.addEventListener(event, (e) => handler(pm, e))
    }

    pm.on("selectionChange", () => this.storedStyles = null)
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

export function dispatchKey(pm, name, e) {
  let seq = pm.input.keySeq
  if (seq) {
    if (isModifierKey(name)) return true
    clearTimeout(stopSeq)
    stopSeq = setTimeout(function() {
      if (pm.input.keySeq == seq)
        pm.input.keySeq = null
    }, 50)
    name = seq + " " + name
  }

  let sawHandler = false
  let handle = function(bound) {
    sawHandler = true
    let result = typeof bound == "string" ? execCommand(pm, bound) : bound(pm)
    return result !== false
  }

  let result
  for (let i = 0; !result && i < pm.input.keymaps.length; i++)
    result = lookupKey(name, pm.input.keymaps[i], handle, pm)
  if (!result)
    result = lookupKey(name, pm.options.extraKeymap, handle, pm) ||
      lookupKey(name, pm.options.keymap, handle, pm)

  if (result == "multi")
    pm.input.keySeq = name

  if (result == "handled" || result == "multi" || sawHandler)
    e.preventDefault()

  if (seq && !result && /\'$/.test(name)) {
    e.preventDefault()
    return true
  }
  return !!result
}

handlers.keydown = (pm, e) => {
  if (e.keyCode == 16) pm.input.shiftKey = true
  let name = keyName(e)
  if (name) dispatchKey(pm, name, e)
}

handlers.keyup = (pm, e) => {
  if (e.keyCode == 16) pm.input.shiftKey = false
}

function inputText(pm, range, text) {
  if (range.empty && !text) return false
  let styles = pm.input.storedStyles || spanStylesAt(pm.doc, range.from)
  let tr = pm.tr
  if (!range.empty) tr.delete(range.from, range.to)
  pm.apply(tr.insert(range.from, Span.text(text, styles)))
  pm.signal("textInput", text)
  pm.scrollIntoView()
}

handlers.keypress = (pm, e) => {
  if (!e.charCode || e.ctrlKey && !e.altKey || browser.mac && e.metaKey) return
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

// FIXME slightly debounce -- firefox fires double event for spelling corrections

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
                html: elt.innerHTML, text: toText(fragment)}

  if (e.clipboardData) {
    e.preventDefault()
    e.clipboardData.clearData()
    e.clipboardData.setData("text/html", lastCopied.html)
    e.clipboardData.setData("text/plain", lastCopied.text)
    if (e.type == "cut" && !sel.empty)
      pm.apply(pm.tr.delete(sel.from, sel.to))
  }
}

handlers.paste = (pm, e) => {
  if (!e.clipboardData) return
  let sel = pm.selection
  let txt = e.clipboardData.getData("text/plain")
  let html = e.clipboardData.getData("text/html")
  if (html || txt) {
    e.preventDefault()
    let doc, from, to
    if (pm.input.shiftKey && txt) {
      let paragraphs = txt.split(/[\r\n]+/)
      let styles = spanStylesAt(pm.doc, sel.from)
      doc = new Node("doc", null, paragraphs.map(s => new Node("paragraph", null, [Span.text(s, styles)])))
    } else if (lastCopied && (lastCopied.html == html || lastCopied.text == txt)) {
      ;({doc, from, to} = lastCopied)
    } else if (html) {
      let elt = document.createElement("div")
      elt.innerHTML = html
      doc = fromDOM(elt)
    } else {
      doc = convertFrom(txt, knownSource("markdown") ? "markdown" : "text")
    }
    pm.apply(pm.tr.replace(sel.from, sel.to, doc, from || Pos.start(doc), to || Pos.end(doc)))
    pm.scrollIntoView()
  }
}

handlers.dragstart = (pm, e) => {
  if (!e.dataTransfer) return

  let elt = document.createElement("div")
  let fragment = pm.selectedDoc
  elt.appendChild(toDOM(fragment, {document: document}))

  e.dataTransfer.setData("text/html", elt.innerHTML)
  e.dataTransfer.setData("text/plain", toText(fragment) + "??")
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
    doc = convertFrom(txt, knownSource("markdown") ? "markdown" : "text")
  }
  if (doc) {
    e.preventDefault()
    let insertPos = pm.posAtCoords({left: e.clientX, top: e.clientY})
    let tr = pm.tr
    if (pm.input.draggingFrom && !e.ctrlKey) {
      let sel = pm.selection
      tr.delete(sel.from, sel.to)
      insertPos = tr.map(insertPos).pos
    }
    tr.replace(insertPos, insertPos, doc, Pos.start(doc), Pos.end(doc))
    pm.apply(tr)
    pm.setSelection(new Range(insertPos, tr.map(insertPos).pos))
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
