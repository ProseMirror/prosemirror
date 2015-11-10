import {Pos, spanStylesAt} from "../model"

import {fromHTML} from "../parse/dom"
import {elt} from "../dom"
import {toHTML} from "../serialize/dom"
import {toText} from "../serialize/text"
import {knownSource, convertFrom} from "../parse"

import {isModifierKey, lookupKey, keyName} from "./keys"
import {dangerousKeys} from "./dangerouskeys"
import {browser, addClass, rmClass} from "../dom"
import {applyDOMChange, textContext, textInContext} from "./domchange"
import {Range, coordsAtPos, rangeFromDOMLoose} from "./selection"

let stopSeq = null

/**
 * A collection of DOM events that occur within the editor, and callback functions
 * to invoke when the event fires.
 */
const handlers = {}

export class Input {
  constructor(pm) {
    this.pm = pm

    this.keySeq = null

    // When the user is creating a composed character,
    // this is set to a Composing instance.
    this.composing = null
    this.shiftKey = this.updatingComposition = false
    this.skipInput = 0

    this.draggingFrom = false

    this.keymaps = []

    this.storedStyles = null

    this.dropTarget = pm.wrapper.appendChild(elt("div", {class: "ProseMirror-drop-target"}))

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

/**
 * Dispatch a key press to the internal keymaps, which will override the default
 * DOM behavior.
 *
 * @param  {ProseMirror}   pm The editor instance.
 * @param  {string}        name The name of the key pressed.
 * @param  {KeyboardEvent} e
 * @return {string} If the key name has a mapping and the callback is invoked ("handled"),
 *                  if the key name needs to be combined in sequence with the next key ("multi"),
 *                  if there is no mapping ("nothing").
 */
export function dispatchKey(pm, name, e) {
  let seq = pm.input.keySeq
  // If the previous key should be used in sequence with this one, modify the name accordingly.
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
    let result = false
    if (Array.isArray(bound)) {
      for (let i = 0; result === false && i < bound.length; i++)
        result = handle(bound[i])
    } else if (typeof bound == "string") {
      result = pm.execCommand(bound)
    } else {
      result = bound(pm)
    }
    return result !== false
  }

  let result
  for (let i = 0; !result && i < pm.input.keymaps.length; i++)
    result = lookupKey(name, pm.input.keymaps[i].map, handle, pm)
  if (!result)
    result = lookupKey(name, pm.options.keymap, handle, pm) || lookupKey(name, dangerousKeys, handle, pm)

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
  let name = keyName(e)
  if (name) dispatchKey(pm, name, e)
  pm.sel.pollForUpdate()
}

handlers.keyup = (pm, e) => {
  if (e.keyCode == 16) pm.input.shiftKey = false
  pm.sel.pollForUpdate()
}

function inputText(pm, range, text) {
  if (range.empty && !text) return false
  let styles = pm.input.storedStyles || spanStylesAt(pm.doc, range.from)
  let tr = pm.tr
  if (!range.empty) tr.delete(range.from, range.to)
  pm.apply(tr.insert(range.from, pm.schema.text(text, styles)))
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

handlers.mousedown = handlers.touchdown = pm => {
  pm.sel.pollForUpdate()
}

handlers.mousemove = (pm, e) => {
  if (e.which || e.button) pm.sel.pollForUpdate()
}

/**
 * A class to track state while creating a composed character.
 */
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
    info.range = new Range(info.range.from, info.range.from.move(info.data.length))
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
  if (range && range.cmp(pm.sel.range)) pm.setSelection(range)
}

handlers.input = (pm) => {
  if (pm.input.skipInput) return --pm.input.skipInput

  if (pm.input.composing) {
    if (pm.input.composing.finished) finishComposing(pm)
    return
  }

  applyDOMChange(pm)
  // FIXME use our own idea of the selection?
  pm.sel.pollForUpdate()
  pm.scrollIntoView()
}

let lastCopied = null

handlers.copy = handlers.cut = (pm, e) => {
  let sel = pm.selection
  if (sel.empty) return
  let fragment = pm.selectedDoc
  lastCopied = {doc: pm.doc, from: sel.from, to: sel.to,
                html: toHTML(fragment, {target: "copy"}),
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
      doc = pm.schema.node("doc", null, paragraphs.map(s => pm.schema.node("paragraph", null, [pm.schema.text(s, styles)])))
    } else if (lastCopied && (lastCopied.html == html || lastCopied.text == txt)) {
      ;({doc, from, to} = lastCopied)
    } else if (html) {
      doc = fromHTML(pm.schema, html, {source: "paste"})
    } else {
      doc = convertFrom(pm.schema, txt, knownSource("markdown") ? "markdown" : "text")
    }
    pm.apply(pm.tr.replace(sel.from, sel.to, doc, from || Pos.start(doc), to || Pos.end(doc)))
    pm.scrollIntoView()
  }
}

handlers.dragstart = (pm, e) => {
  if (!e.dataTransfer) return

  let fragment = pm.selectedDoc

  e.dataTransfer.setData("text/html", toHTML(fragment, {target: "copy"}))
  e.dataTransfer.setData("text/plain", toText(fragment) + "??")
  pm.input.draggingFrom = true
}

handlers.dragend = pm => window.setTimeout(() => pm.input.dragginFrom = false, 50)

handlers.dragover = handlers.dragenter = (pm, e) => {
  e.preventDefault()
  let cursorPos = pm.posAtCoords({left: e.clientX, top: e.clientY})
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
  if (!e.dataTransfer) return

  let html, txt, doc
  if (html = e.dataTransfer.getData("text/html"))
    doc = fromHTML(pm.schema, html, {source: "paste"})
  else if (txt = e.dataTransfer.getData("text/plain"))
    doc = convertFrom(pm.schema, txt, knownSource("markdown") ? "markdown" : "text")

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

  pm.input.dropTarget.style.display = ""
}

handlers.focus = pm => {
  addClass(pm.wrapper, "ProseMirror-focused")
  pm.signal("focus")
}

handlers.blur = pm => {
  rmClass(pm.wrapper, "ProseMirror-focused")
  pm.signal("blur")
}
