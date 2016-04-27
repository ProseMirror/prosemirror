import {Slice} from "../model"
import Keymap from "browserkeymap"
import {parseFrom, fromDOM, toHTML, toText} from "../format"

import {captureKeys} from "./capturekeys"
import {elt, browser, contains} from "../dom"

import {readInputChange, readCompositionChange} from "./domchange"
import {findSelectionAtStart, findSelectionAtEnd, findSelectionNear, hasFocus} from "./selection"
import {posBeforeFromDOM, handleNodeClick, selectableNodeAbove} from "./dompos"

let stopSeq = null

// A collection of DOM events that occur within the editor, and callback functions
// to invoke when the event fires.
const handlers = {}

export class Input {
  constructor(pm) {
    this.pm = pm
    this.baseKeymap = null

    this.keySeq = null

    this.mouseDown = null
    this.dragging = null
    this.dropTarget = null
    this.shiftKey = false
    this.finishComposing = null

    this.keymaps = []
    this.defaultKeymap = null

    this.storedMarks = null

    for (let event in handlers) {
      let handler = handlers[event]
      pm.content.addEventListener(event, e => handler(pm, e))
    }

    pm.on("selectionChange", () => this.storedMarks = null)
  }

  // Dispatch a key press to the internal keymaps, which will override the default
  // DOM behavior.
  dispatchKey(name, e) {
    let pm = this.pm, seq = pm.input.keySeq
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

    if ((result == "handled" || result == "multi") && e)
      e.preventDefault()

    if (seq && !result && /\'$/.test(name)) {
      if (e) e.preventDefault()
      return true
    }
    return !!result
  }

  // : (ProseMirror, TextSelection, string, ?(Node) → Selection)
  // Insert text into a document.
  insertText(from, to, text, findSelection) {
    if (from == to && !text) return
    let pm = this.pm, marks = pm.input.storedMarks || pm.doc.marksAt(from)
    let tr = pm.tr.replaceWith(from, to, text ? pm.schema.text(text, marks) : null)
    tr.apply({
      scrollIntoView: true,
      selection: findSelection && findSelection(tr.doc) || findSelectionNear(tr.doc, tr.map(to), -1, true)
    })
    // :: () #path=ProseMirror#events#textInput
    // Fired when the user types text into the editor.
    if (text) pm.signal("textInput", text)
  }

  get composing() {
    return this.pm.operation && this.pm.operation.composing
  }

  startComposition(dataLen, realStart) {
    this.pm.ensureOperation({noFlush: true, readSelection: realStart}).composing = {
      ended: false,
      applied: false,
      margin: dataLen
    }
    this.pm.unscheduleFlush()
  }

  applyComposition(andFlush) {
    let composing = this.composing
    if (composing.applied) return
    readCompositionChange(this.pm, composing.margin)
    composing.applied = true
    // Operations that read DOM changes must be flushed, to make sure
    // subsequent DOM changes find a clean DOM.
    if (andFlush) this.pm.flush()
  }
}

handlers.keydown = (pm, e) => {
  // :: () #path=ProseMirror#events#interaction
  // Fired when the user interacts with the editor, for example by
  // clicking on it or pressing a key while it is focused. Mostly
  // useful for closing or resetting transient UI state such as open
  // menus.
  if (!hasFocus(pm)) return
  pm.signal("interaction")
  if (e.keyCode == 16) pm.input.shiftKey = true
  if (pm.input.composing) return
  let name = Keymap.keyName(e)
  if (name && pm.input.dispatchKey(name, e)) return
  pm.sel.fastPoll()
}

handlers.keyup = (pm, e) => {
  if (e.keyCode == 16) pm.input.shiftKey = false
}

handlers.keypress = (pm, e) => {
  if (!hasFocus(pm) || pm.input.composing || !e.charCode ||
      e.ctrlKey && !e.altKey || browser.mac && e.metaKey) return
  if (pm.input.dispatchKey(Keymap.keyName(e), e)) return
  let sel = pm.selection
  // On iOS, let input through, because if we handle it the virtual
  // keyboard's default case doesn't update (it only does so when the
  // user types or taps, not on selection updates from JavaScript).
  if (!browser.ios) {
    pm.input.insertText(sel.from, sel.to, String.fromCharCode(e.charCode))
    e.preventDefault()
  }
}

function realTarget(pm, mouseEvent) {
  if (pm.operation && pm.flush())
    return document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY)
  else
    return mouseEvent.target
}

function selectClickedNode(pm, e, target) {
  let pos = selectableNodeAbove(pm, target, {left: e.clientX, top: e.clientY}, true)
  if (pos == null) return pm.sel.fastPoll()

  let {node, from} = pm.selection
  if (node) {
    let $pos = pm.doc.resolve(pos), $from = pm.doc.resolve(from)
    if ($pos.depth >= $from.depth && $pos.before($from.depth) == from) {
      if ($from.depth == 0) return pm.sel.fastPoll()
      pos = $pos.before($pos.depth)
    }
  }

  pm.setNodeSelection(pos)
  pm.focus()
  e.preventDefault()
}

let lastClick = 0, oneButLastClick = 0

function handleTripleClick(pm, e, target) {
  e.preventDefault()
  let pos = selectableNodeAbove(pm, target, {left: e.clientX, top: e.clientY}, true)
  if (pos != null) {
    let $pos = pm.doc.resolve(pos), node = $pos.nodeAfter
    if (node.isBlock && !node.isTextblock) // Non-textblock block, select it
      pm.setNodeSelection(pos)
    else if (node.isInline) // Inline node, select whole parent
      pm.setTextSelection($pos.start($pos.depth), $pos.end($pos.depth))
    else // Textblock, select content
      pm.setTextSelection(pos + 1, pos + 1 + node.content.size)
    pm.focus()
  }
}

handlers.mousedown = (pm, e) => {
  pm.signal("interaction")
  let now = Date.now(), doubleClick = now - lastClick < 500, tripleClick = now - oneButLastClick < 600
  oneButLastClick = lastClick
  lastClick = now

  let target = realTarget(pm, e)
  if (tripleClick) handleTripleClick(pm, e, target)
  else if (doubleClick && handleNodeClick(pm, "handleDoubleClick", e, target, true)) {}
  else pm.input.mouseDown = new MouseDown(pm, e, target, doubleClick)
}

class MouseDown {
  constructor(pm, event, target, doubleClick) {
    this.pm = pm
    this.event = event
    this.target = target
    this.leaveToBrowser = pm.input.shiftKey || doubleClick

    let pos = posBeforeFromDOM(pm, this.target), node = pm.doc.nodeAt(pos)
    this.mightDrag = node.type.draggable || node == pm.sel.range.node ? pos : null
    if (this.mightDrag != null) {
      this.target.draggable = true
      if (browser.gecko && (this.setContentEditable = !this.target.hasAttribute("contentEditable")))
        this.target.setAttribute("contentEditable", "false")
    }

    this.x = event.clientX; this.y = event.clientY

    window.addEventListener("mouseup", this.up = this.up.bind(this))
    window.addEventListener("mousemove", this.move = this.move.bind(this))
    pm.sel.fastPoll()
  }

  done() {
    window.removeEventListener("mouseup", this.up)
    window.removeEventListener("mousemove", this.move)
    if (this.mightDrag != null) {
      this.target.draggable = false
      if (browser.gecko && this.setContentEditable)
        this.target.removeAttribute("contentEditable")
    }
  }

  up(event) {
    this.done()

    let target = realTarget(this.pm, event)
    if (this.leaveToBrowser || !contains(this.pm.content, target)) {
      this.pm.sel.fastPoll()
    } else if (this.event.ctrlKey) {
      selectClickedNode(this.pm, event, target)
    } else if (!handleNodeClick(this.pm, "handleClick", event, target, true)) {
      let pos = selectableNodeAbove(this.pm, target, {left: this.x, top: this.y})
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
  handleNodeClick(pm, "handleContextMenu", e, realTarget(pm, e), false)
}

// Input compositions are hard. Mostly because the events fired by
// browsers are A) very unpredictable and inconsistent, and B) not
// cancelable.
//
// ProseMirror has the problem that it must not update the DOM during
// a composition, or the browser will cancel it. What it does is keep
// long-running operations (delayed DOM updates) when a composition is
// active.
//
// We _do not_ trust the information in the composition events which,
// apart from being very uninformative to begin with, is often just
// plain wrong. Instead, when a composition ends, we parse the dom
// around the original selection, and derive an update from that.

handlers.compositionstart = (pm, e) => {
  if (!pm.input.composing && hasFocus(pm))
    pm.input.startComposition(e.data ? e.data.length : 0, true)
}

handlers.compositionupdate = pm => {
  if (!pm.input.composing && hasFocus(pm))
    pm.input.startComposition(0, false)
}

handlers.compositionend = (pm, e) => {
  if (!hasFocus(pm)) return
  let composing = pm.input.composing
  if (!composing) {
    // We received a compositionend without having seen any previous
    // events for the composition. If there's data in the event
    // object, we assume that it's a real change, and start a
    // composition. Otherwise, we just ignore it.
    if (e.data) pm.input.startComposition(e.data.length, false)
    else return
  } else if (composing.applied) {
    // This happens when a flush during composition causes a
    // syncronous compositionend.
    return
  }

  clearTimeout(pm.input.finishComposing)
  pm.operation.composing.ended = true
  // Applying the composition right away from this event confuses
  // Chrome (and probably other browsers), causing them to re-update
  // the DOM afterwards. So we apply the composition either in the
  // next input event, or after a short interval.
  pm.input.finishComposing = window.setTimeout(() => {
    let composing = pm.input.composing
    if (composing && composing.ended) pm.input.applyComposition(true)
  }, 20)
}

handlers.input = pm => {
  if (!hasFocus(pm)) return
  let composing = pm.input.composing
  if (composing) {
    // Ignore input events during composition, except when the
    // composition has ended, in which case we can apply it.
    if (composing.ended) pm.input.applyComposition(true)
    return
  }

  // Read the changed DOM and derive an update from that.
  readInputChange(pm)
  pm.flush()
}

function toClipboard(doc, from, to, dataTransfer) {
  let slice = doc.slice(from, to), $from = doc.resolve(from)
  let parent = $from.node($from.depth - slice.openLeft)
  let attr = `${parent.type.name} ${slice.openLeft} ${slice.openRight}`
  let html = `<div pm-context="${attr}">${toHTML(slice.content)}</div>`
  dataTransfer.clearData()
  dataTransfer.setData("text/html", html)
  dataTransfer.setData("text/plain", toText(slice.content))
  return slice
}

let cachedCanUpdateClipboard = null

function canUpdateClipboard(dataTransfer) {
  if (cachedCanUpdateClipboard != null) return cachedCanUpdateClipboard
  dataTransfer.setData("text/html", "<hr>")
  return cachedCanUpdateClipboard = dataTransfer.getData("text/html") == "<hr>"
}

// :: (text: string) → string #path=ProseMirror#events#transformPastedText
// Fired when plain text is pasted. Handlers must return the given
// string or a [transformed](#EventMixin.signalPipelined) version of
// it.

// :: (html: string) → string #path=ProseMirror#events#transformPastedHTML
// Fired when html content is pasted or dragged into the editor.
// Handlers must return the given string or a
// [transformed](#EventMixin.signalPipelined) version of it.

// :: (slice: Slice) → Slice #path=ProseMirror#events#transformPasted
// Fired when something is pasted or dragged into the editor. The
// given slice represents the pasted content, and your handler can
// return a modified version to manipulate it before it is inserted
// into the document.

// : (ProseMirror, DataTransfer, ?bool) → ?Slice
function fromClipboard(pm, dataTransfer, plainText) {
  let txt = dataTransfer.getData("text/plain")
  let html = dataTransfer.getData("text/html")
  if (!html && !txt) return null
  let doc, slice
  if ((plainText || !html) && txt) {
    doc = parseFrom(pm.schema, pm.signalPipelined("transformPastedText", txt), "text")
  } else {
    let dom = document.createElement("div")
    dom.innerHTML = pm.signalPipelined("transformPastedHTML", html)
    let wrap = dom.querySelector("[pm-context]"), context, contextNodeType, found
    if (wrap && (context = /^(\w+) (\d+) (\d+)$/.exec(wrap.getAttribute("pm-context"))) &&
        (contextNodeType = pm.schema.nodes[context[1]]) && contextNodeType.defaultAttrs &&
        (found = parseFromContext(wrap, contextNodeType, +context[2], +context[3])))
      slice = found
    else
      doc = fromDOM(pm.schema, dom)
  }
  if (!slice)
    slice = doc.slice(findSelectionAtStart(doc).from, findSelectionAtEnd(doc).to)
  return pm.signalPipelined("transformPasted", slice)
}

function parseFromContext(dom, contextNodeType, openLeft, openRight) {
  let schema = contextNodeType.schema, contextNode = contextNodeType.create()
  let parsed = fromDOM(schema, dom, {topNode: contextNode, preserveWhitespace: true})
  return new Slice(parsed.content, clipOpen(parsed.content, openLeft, true),
                   clipOpen(parsed.content, openRight, false), contextNode)
}

function clipOpen(fragment, max, start) {
  for (let i = 0; i < max; i++) {
    let node = start ? fragment.firstChild : fragment.lastChild
    if (!node || node.type.contains == null) return i
    fragment = node.content
  }
  return max
}

handlers.copy = handlers.cut = (pm, e) => {
  let {from, to, empty} = pm.selection
  if (empty || !e.clipboardData || !canUpdateClipboard(e.clipboardData)) return
  toClipboard(pm.doc, from, to, e.clipboardData)
  e.preventDefault()
  if (e.type == "cut" && !empty)
    pm.tr.delete(from, to).apply()
}

handlers.paste = (pm, e) => {
  if (!hasFocus(pm)) return
  if (!e.clipboardData) return
  let sel = pm.selection
  let slice = fromClipboard(pm, e.clipboardData, pm.input.shiftKey)
  if (slice) {
    e.preventDefault()
    pm.tr.replace(sel.from, sel.to, slice).apply(pm.apply.scroll)
  }
}

class Dragging {
  constructor(slice, from, to) {
    this.slice = slice
    this.from = from
    this.to = to
  }
}

function dropPos(pm, e, slice) {
  let pos = pm.posAtCoords({left: e.clientX, top: e.clientY})
  if (pos == null || !slice || !slice.content.size) return pos
  let $pos = pm.doc.resolve(pos), kind = slice.content.leastSuperKind()
  for (let d = $pos.depth; d >= 0; d--) {
    if (kind.isSubKind($pos.node(d).type.contains)) {
      if (d == $pos.depth) return pos
      if (pos <= ($pos.start(d + 1) + $pos.end(d + 1)) / 2) return $pos.before(d + 1)
      return $pos.after(d + 1)
    }
  }
  return pos
}

function removeDropTarget(pm) {
  if (pm.input.dropTarget) {
    pm.wrapper.removeChild(pm.input.dropTarget)
    pm.input.dropTarget = null
  }
}

handlers.dragstart = (pm, e) => {
  let mouseDown = pm.input.mouseDown
  if (mouseDown) mouseDown.done()

  if (!e.dataTransfer) return

  let {from, to, empty} = pm.selection, dragging
  let pos = !empty && pm.posAtCoords({left: e.clientX, top: e.clientY})
  if (pos != null && pos >= from && pos <= to) {
    dragging = {from, to}
  } else if (mouseDown && mouseDown.mightDrag != null) {
    let pos = mouseDown.mightDrag
    dragging = {from: pos, to: pos + pm.doc.nodeAt(pos).nodeSize}
  }

  if (dragging) {
    let slice = toClipboard(pm.doc, dragging.from, dragging.to, e.dataTransfer)
    // FIXME the document could change during a drag, invalidating this range
    // use a marked range?
    pm.input.dragging = new Dragging(slice, dragging.from, dragging.to)
  }
}

handlers.dragend = pm => {
  removeDropTarget(pm)
  window.setTimeout(() => pm.input.dragging = null, 50)
}

handlers.dragover = handlers.dragenter = (pm, e) => {
  e.preventDefault()

  let target = pm.input.dropTarget
  if (!target)
    target = pm.input.dropTarget = pm.wrapper.appendChild(elt("div", {class: "ProseMirror-drop-target"}))

  let pos = dropPos(pm, e, pm.input.dragging && pm.input.dragging.slice)
  if (pos == null) return
  let coords = pm.coordsAtPos(pos)
  let rect = pm.wrapper.getBoundingClientRect()
  coords.top -= rect.top
  coords.right -= rect.left
  coords.bottom -= rect.top
  coords.left -= rect.left
  target.style.left = (coords.left - 1) + "px"
  target.style.top = coords.top + "px"
  target.style.height = (coords.bottom - coords.top) + "px"
}

handlers.dragleave = (pm, e) => {
  if (e.target == pm.content) removeDropTarget(pm)
}

handlers.drop = (pm, e) => {
  let dragging = pm.input.dragging
  pm.input.dragging = null
  removeDropTarget(pm)

  // :: (event: DOMEvent) #path=ProseMirror#events#drop
  // Fired when a drop event occurs on the editor content. A handler
  // may declare the event handled by calling `preventDefault` on it
  // or returning a truthy value.
  if (!e.dataTransfer || pm.signalDOM(e)) return

  let slice = dragging && dragging.slice || fromClipboard(pm, e.dataTransfer)
  if (slice) {
    e.preventDefault()
    let insertPos = dropPos(pm, e, slice), start = insertPos
    if (insertPos == null) return
    let tr = pm.tr
    if (dragging && !e.ctrlKey && dragging.from != null) {
      tr.delete(dragging.from, dragging.to)
      insertPos = tr.map(insertPos)
    }
    tr.replace(insertPos, insertPos, slice).apply()
    let found
    if (slice.content.childCount == 1 && slice.openLeft == 0 && slice.openRight == 0 &&
        slice.content.child(0).type.selectable &&
        (found = pm.doc.nodeAt(insertPos)) && found.sameMarkup(slice.content.child(0))) {
      pm.setNodeSelection(insertPos)
    } else {
      let left = findSelectionNear(pm.doc, insertPos, 1, true).from
      let right = findSelectionNear(pm.doc, tr.map(start), -1, true).to
      pm.setTextSelection(left, right)
    }
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
