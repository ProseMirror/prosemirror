import {Pos, $node, $text, spanStylesAt} from "../model"

import {fromHTML} from "../convert/from_dom"
import {toHTML} from "../convert/to_dom"
import {toText} from "../convert/to_text"
import {knownSource, convertFrom} from "../convert"

import {isModifierKey, lookupKey, keyName} from "./keys"
import {browser, addClass, rmClass} from "../dom"
import {execCommand} from "./commands"
import {applyDOMChange, textContext, textInContext} from "./domchange"
import {Range} from "./selection"

let stopSeq = null
const handlers = {}

export class Input {
  constructor(pm) {
    this.pm = pm

    this.keySeq = null
    this.composing = null
    this.shiftKey = this.updatingComposition = false
    this.skipInput = 0

    this.draggingFrom = false

    this.keymaps = []

    this.storedStyles = null

    for (let event in handlers) {
      let handler = handlers[event]
      pm.content.addEventListener(event, e => handler(pm, e))
    }

    pm.on("selectionChange", () => this.storedStyles = null)
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

  let handle = function(bound) {
    let result = typeof bound == "string" ? execCommand(pm, bound) : bound(pm)
    return result !== false
  }

  let result
  for (let i = pm.input.keymaps.length - 1; !result && i >= 0; i--)
    result = lookupKey(name, pm.input.keymaps[i], handle, pm)
  if (!result)
    result = lookupKey(name, pm.options.keymap, handle, pm)

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
  pm.apply(tr.insert(range.from, $text(text, styles)))
  pm.signal("textInput", text)
  pm.scrollIntoView()
}

handlers.keypress = (pm, e) => {
  if (pm.input.composing || !e.charCode || e.ctrlKey && !e.altKey || browser.mac && e.metaKey) return
  let ch = String.fromCharCode(e.charCode)
  if (dispatchKey(pm, "'" + ch + "'", e)) return
  inputText(pm, pm.selection, ch)
  e.preventDefault()
}

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
        range = new Range(new Pos(path, found), new Pos(path, found + data.length))
    }
    this.range = range
  }
}

handlers.compositionstart = (pm, e) => {
  if (pm.input.maybeAbortComposition()) return

  pm.flush()
  pm.input.composing = new Composing(pm, e.data)
}

handlers.compositionupdate = (pm, e) => {
  let info = pm.input.composing
  if (info && info.data != e.data) {
    info.data = e.data
    pm.input.updatingComposition = true
    inputText(pm, info.range, info.data)
    pm.input.updatingComposition = false
    info.range = new Range(info.range.from, info.range.from.shift(info.data.length))
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
  if (text != info.data) pm.ensureOperation()
  pm.input.composing = null
  if (text != info.data) inputText(pm, info.range, text)
}

handlers.input = (pm) => {
  if (pm.input.skipInput) return --pm.input.skipInput

  if (pm.input.composing) {
    if (pm.input.composing.finished) finishComposing(pm)
    return
  }

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
  let fragment = pm.selectedDoc
  lastCopied = {doc: pm.doc, from: sel.from, to: sel.to,
                html: toHTML(fragment, {document}),
                text: toText(fragment)}

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
      doc = $node("doc", null, paragraphs.map(s => $node("paragraph", null, [$text(s, styles)])))
    } else if (lastCopied && (lastCopied.html == html || lastCopied.text == txt)) {
      ;({doc, from, to} = lastCopied)
    } else if (html) {
      doc = fromHTML(html, {document})
    } else {
      doc = convertFrom(txt, knownSource("markdown") ? "markdown" : "text")
    }
    pm.apply(pm.tr.replace(sel.from, sel.to, doc, from || Pos.start(doc), to || Pos.end(doc)))
    pm.scrollIntoView()
  }
}

handlers.dragstart = (pm, e) => {
  if (!e.dataTransfer) return

  let fragment = pm.selectedDoc

  e.dataTransfer.setData("text/html", toHTML(fragment, {document}))
  e.dataTransfer.setData("text/plain", toText(fragment) + "??")
  pm.input.draggingFrom = true
}

handlers.dragend = pm => window.setTimeout(() => pm.input.dragginFrom = false, 50)

handlers.dragover = handlers.dragenter = (_, e) => e.preventDefault()

handlers.drop = (pm, e) => {
  if (!e.dataTransfer) return

  let html, txt, doc
  if (html = e.dataTransfer.getData("text/html"))
    doc = fromHTML(html, {document})
  else if (txt = e.dataTransfer.getData("text/plain"))
    doc = convertFrom(txt, knownSource("markdown") ? "markdown" : "text")

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
