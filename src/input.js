import {fromDOM, fromText, toDOM, toText, Pos, slice} from "./model"

import * as keys from "./keys"
import * as dom from "./dom"
import commands from "./commands"

let stopSeq = null
const handlers = {}

function dispatchKey(pm, name, e) {
  let seq = pm.state.keySeq
  if (seq) {
    if (keys.isModifierKey(name)) return true
    clearTimeout(stopSeq)
    stopSeq = setTimeout(function() {
      if (pm.state.keySeq == seq)
        pm.state.keySeq = null;
    }, 50)
    name = seq + " " + name
  }

  let handle = function(bound) {
    if (typeof bound == "string") {
      bound = commands[bound]
      if (!bound) return false
    }
    return bound(pm) !== false
  }

  let result
  for (let i = 0; !result && i < pm.state.keymaps.length; i++)
    result = keys.lookupKey(name, pm.state.keymaps[i], handle, pm)
  if (!result)
    result = keys.lookupKey(name, pm.options.extraKeymap, handle, pm) ||
      keys.lookupKey(name, pm.options.keymap, handle, pm)

  if (result == "multi")
    pm.state.keySeq = name

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
  pm.apply({name: "replace", pos: range.from, end: range.end, text: text})
  pm.signal("textInput", text, pm.selection.head)
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
  pm.state.composing = {sel: pm.selection,
                        data: data,
                        startData: data}
  pm.state.composeActive++
  // FIXME set selection around existing data if applicable
}

handlers.compositionupdate = (pm, e) => {
  pm.state.composing.data = e.data;
}

handlers.compositionend = (pm, e) => {
  let info = pm.state.composing
  if (!info) return
  pm.state.composing = null
  if (e.data != info.startData && !/\u200b/.test(e.data))
    info.data = e.data
  applyComposition(pm, info)
  // Disable input events for a short time more
  setTimeout((() => pm.state.composeActive--), 50)
}

function applyComposition(pm, info) {
  inputText(pm, info.sel, info.data)
}

handlers.input = (pm) => {
  if (pm.state.composeActive) return
  console.log("INPUT EVENT!");
  // FIXME poll DOM for changes
}

let lastCopied = null

handlers.copy = handlers.cut = (pm, e) => {
  let sel = pm.selection
  if (sel.empty) return
  let elt = document.createElement("div")
  let fragment = slice.between(pm.doc, sel.from, sel.to)
  elt.appendChild(toDOM(fragment, {document: document}))
  lastCopied = {doc: pm.doc, from: sel.from, to: sel.to,
                html: elt.innerHTML, text: toText(fragment)}

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
      doc = fromText(text)
    }
    pm.apply({name: "replace", pos: sel.from, end: sel.to,
              source: doc, from: from || Pos.start(doc), to: to || Pos.end(doc)})
  }
}

exports.registerHandlers = function(pm) {
  for (let event in handlers) {
    let handler = handlers[event]
    pm.content.addEventListener(event, (e) => handler(pm, e))
  }
}
