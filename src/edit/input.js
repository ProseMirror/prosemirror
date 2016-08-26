const Keymap = require("browserkeymap")
const browser = require("../util/browser")
const {Slice, Fragment, parseDOMInContext} = require("../model")

const {captureKeys} = require("./capturekeys")
const {elt, contains} = require("../util/dom")

const {readInputChange, readCompositionChange} = require("./domchange")
const {Selection, hasFocus} = require("./selection")

let stopSeq = null

// A collection of DOM events that occur within the editor, and callback functions
// to invoke when the event fires.
const handlers = {}

class Input {
  constructor(pm) {
    this.pm = pm

    this.keySeq = null

    this.mouseDown = null
    this.dragging = null
    this.dropTarget = null
    this.shiftKey = false
    this.finishComposing = null

    this.keymaps = []

    this.storedMarks = null

    for (let event in handlers) {
      let handler = handlers[event]
      pm.content.addEventListener(event, e => handler(pm, e))
    }

    pm.on.selectionChange.add(() => this.storedMarks = null)
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
      if (bound == Keymap.unfinished) return "multi"
      if (bound == null) return false
      return bound(pm) == false ? false : "handled"
    }

    let result
    for (let i = 0; !result && i < pm.input.keymaps.length; i++)
      result = handle(pm.input.keymaps[i].map.lookup(name, pm))
    if (!result)
      result = handle(captureKeys.lookup(name))

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
    tr.setSelection(findSelection && findSelection(tr.doc) || Selection.findNear(tr.doc.resolve(tr.map(to)), -1))
    tr.applyAndScroll()
    if (text) pm.on.textInput.dispatch(text)
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
exports.Input = Input

handlers.keydown = (pm, e) => {
  if (!hasFocus(pm)) return
  pm.on.interaction.dispatch()
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

function contextFromEvent(pm, event) {
  return pm.contextAtCoords({left: event.clientX, top: event.clientY})
}

function selectClickedNode(pm, context) {
  let {node: selectedNode, $from} = pm.selection, selectAt

  for (let i = context.inside.length - 1; i >= 0; i--) {
    let {pos, node} = context.inside[i]
    if (node.type.selectable) {
      selectAt = pos
      if (selectedNode && $from.depth > 0) {
        let $pos = pm.doc.resolve(pos)
        if ($pos.depth >= $from.depth && $pos.before($from.depth + 1) == $from.pos)
          selectAt = $pos.before($from.depth)
      }
      break
    }
  }

  if (selectAt != null) {
    pm.setNodeSelection(selectAt)
    pm.focus()
    return true
  } else {
    return false
  }
}

let lastClick = {time: 0, x: 0, y: 0}, oneButLastClick = lastClick

function isNear(event, click) {
  let dx = click.x - event.clientX, dy = click.y - event.clientY
  return dx * dx + dy * dy < 100
}

function handleTripleClick(pm, context) {
  for (let i = context.inside.length - 1; i >= 0; i--) {
    let {pos, node} = context.inside[i]
    if (node.isTextblock)
      pm.setTextSelection(pos + 1, pos + 1 + node.content.size)
    else if (node.type.selectable)
      pm.setNodeSelection(pos)
    else
      continue
    pm.focus()
    break
  }
}

function runHandlerOnContext(handler, context, event) {
  for (let i = context.inside.length - 1; i >= 0; i--)
    if (handler.dispatch(context.pos, context.inside[i].node, context.inside[i].pos, event))
      return true
}

handlers.mousedown = (pm, e) => {
  pm.on.interaction.dispatch()
  let now = Date.now()
  let doubleClick = now - lastClick.time < 500 && isNear(e, lastClick)
  let tripleClick = doubleClick && now - oneButLastClick.time < 600 && isNear(e, oneButLastClick)
  oneButLastClick = lastClick
  lastClick = {time: now, x: e.clientX, y: e.clientY}

  let context = contextFromEvent(pm, e)
  if (context == null) return
  if (tripleClick) {
    e.preventDefault()
    handleTripleClick(pm, context)
  } else if (doubleClick) {
    if (runHandlerOnContext(pm.on.doubleClickOn, context, e) || pm.on.doubleClick.dispatch(context.pos, e))
      e.preventDefault()
    else
      pm.sel.fastPoll()
  } else {
    pm.input.mouseDown = new MouseDown(pm, e, context, doubleClick)
  }
}

class MouseDown {
  constructor(pm, event, context, doubleClick) {
    this.pm = pm
    this.event = event
    this.context = context
    this.leaveToBrowser = pm.input.shiftKey || doubleClick
    this.x = event.clientX; this.y = event.clientY

    let inner = context.inside[context.inside.length - 1]
    this.mightDrag = inner && (inner.node.type.draggable || inner.node == pm.sel.range.node) ? inner : null
    this.target = event.target
    if (this.mightDrag) {
      if (!contains(pm.content, this.target))
        this.target = pm.root.elementFromPoint(this.x, this.y)
      this.target.draggable = true
      if (browser.gecko && (this.setContentEditable = !this.target.hasAttribute("contentEditable")))
        this.target.setAttribute("contentEditable", "false")
    }

    window.addEventListener("mouseup", this.up = this.up.bind(this))
    window.addEventListener("mousemove", this.move = this.move.bind(this))
    pm.sel.fastPoll()
  }

  done() {
    window.removeEventListener("mouseup", this.up)
    window.removeEventListener("mousemove", this.move)
    if (this.mightDrag) {
      this.target.draggable = false
      if (browser.gecko && this.setContentEditable)
        this.target.removeAttribute("contentEditable")
    }
  }

  up(event) {
    this.done()

    if (this.leaveToBrowser || !contains(this.pm.content, event.target))
      return this.pm.sel.fastPoll()

    let context = contextFromEvent(this.pm, event)
    if (this.event.ctrlKey && selectClickedNode(this.pm, context)) {
      event.preventDefault()
    } else if (runHandlerOnContext(this.pm.on.clickOn, this.context, event) ||
               this.pm.on.click.dispatch(this.context.pos, event)) {
      event.preventDefault()
    } else {
      let inner = this.context.inside[this.context.inside.length - 1]
      if (inner && inner.node.type.isLeaf && inner.node.type.selectable) {
        this.pm.setNodeSelection(inner.pos)
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
  let context = contextFromEvent(pm, e)
  if (context) {
    let inner = context.inside[context.inside.length - 1]
    if (pm.on.contextMenu.dispatch(context.pos, inner ? inner.node : pm.doc, e))
      e.preventDefault()
  }
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

function readInput(pm) {
  let composing = pm.input.composing
  if (composing) {
    // Ignore input events during composition, except when the
    // composition has ended, in which case we can apply it.
    if (composing.ended) pm.input.applyComposition(true)
    return true
  }

  // Read the changed DOM and derive an update from that.
  let result = readInputChange(pm)
  pm.flush()
  return result
}

function readInputSoon(pm) {
  window.setTimeout(() => {
    if (!readInput(pm)) window.setTimeout(() => readInput(pm), 80)
  }, 20)
}

handlers.input = pm => {
  if (hasFocus(pm)) readInput(pm)
}

function toClipboard(doc, from, to, dataTransfer) {
  let $from = doc.resolve(from), start = from
  for (let d = $from.depth; d > 0 && $from.end(d) == start; d--) start++
  let slice = doc.slice(start, to)
  if (slice.possibleParent.type != doc.type.schema.nodes.doc)
    slice = new Slice(Fragment.from(slice.possibleParent.copy(slice.content)), slice.openLeft + 1, slice.openRight + 1)
  let dom = slice.content.toDOM(), wrap = document.createElement("div")
  if (dom.firstChild && dom.firstChild.nodeType == 1)
    dom.firstChild.setAttribute("pm-open-left", slice.openLeft)
  wrap.appendChild(dom)
  dataTransfer.clearData()
  dataTransfer.setData("text/html", wrap.innerHTML)
  dataTransfer.setData("text/plain", slice.content.textBetween(0, slice.content.size, "\n\n"))
  return slice
}

let cachedCanUpdateClipboard = null

function canUpdateClipboard(dataTransfer) {
  if (cachedCanUpdateClipboard != null) return cachedCanUpdateClipboard
  dataTransfer.setData("text/html", "<hr>")
  return cachedCanUpdateClipboard = dataTransfer.getData("text/html") == "<hr>"
}

// : (ProseMirror, DataTransfer, ?bool, ResolvedPos) → ?Slice
function fromClipboard(pm, dataTransfer, plainText, $target) {
  let txt = dataTransfer.getData("text/plain")
  let html = dataTransfer.getData("text/html")
  if (!html && !txt) return null
  let dom
  if ((plainText || !html) && txt) {
    dom = document.createElement("div")
    pm.on.transformPastedText.dispatch(txt).split(/(?:\r\n?|\n){2,}/).forEach(block => {
      let para = dom.appendChild(document.createElement("p"))
      block.split(/\r\n?|\n/).forEach((line, i) => {
        if (i) para.appendChild(document.createElement("br"))
        para.appendChild(document.createTextNode(line))
      })
    })
  } else {
    dom = readHTML(pm.on.transformPastedHTML.dispatch(html))
  }
  let openLeft = null, m
  let foundLeft = dom.querySelector("[pm-open-left]")
  if (foundLeft && (m = /^\d+$/.exec(foundLeft.getAttribute("pm-open-left"))))
    openLeft = +m[0]
  let slice = parseDOMInContext($target, dom, {openLeft, preserveWhiteSpace: true})
  return pm.on.transformPasted.dispatch(slice)
}

function insertRange($from, $to) {
  let from = $from.pos, to = $to.pos
  for (let d = $to.depth; d > 0 && $to.end(d) == to; d--) to++
  for (let d = $from.depth; d > 0 && $from.start(d) == from && $from.end(d) <= to; d--) from--
  return {from, to}
}

// Trick from jQuery -- some elements must be wrapped in other
// elements for innerHTML to work. I.e. if you do `div.innerHTML =
// "<td>..</td>"` the table cells are ignored.
const wrapMap = {thead: "table", colgroup: "table", col: "table colgroup",
                 tr: "table tbody", td: "table tbody tr", th: "table tbody tr"}
function readHTML(html) {
  let metas = /(\s*<meta [^>]*>)*/.exec(html)
  if (metas) html = html.slice(metas[0].length)
  let elt = document.createElement("div")
  let firstTag = /(?:<meta [^>]*>)*<([a-z][^>\s]+)/i.exec(html), wrap, depth = 0
  if (wrap = firstTag && wrapMap[firstTag[1].toLowerCase()]) {
    let nodes = wrap.split(" ")
    html = nodes.map(n => "<" + n + ">").join("") + html + nodes.map(n => "</" + n + ">").reverse().join("")
    depth = nodes.length
  }
  elt.innerHTML = html
  for (let i = 0; i < depth; i++) elt = elt.firstChild
  return elt
}

handlers.copy = handlers.cut = (pm, e) => {
  let {from, to, empty} = pm.selection, cut = e.type == "cut"
  if (empty) return
  if (!e.clipboardData || !canUpdateClipboard(e.clipboardData)) {
    if (cut && browser.ie && browser.ie_version <= 11) readInputSoon(pm)
    return
  }
  toClipboard(pm.doc, from, to, e.clipboardData)
  e.preventDefault()
  if (cut) pm.tr.delete(from, to).apply()
}

handlers.paste = (pm, e) => {
  if (!hasFocus(pm) || pm.on.domPaste.dispatch(e)) return
  if (!e.clipboardData) {
    if (browser.ie && browser.ie_version <= 11) readInputSoon(pm)
    return
  }
  let sel = pm.selection, range = insertRange(sel.$from, sel.$to)
  let slice = fromClipboard(pm, e.clipboardData, pm.input.shiftKey, pm.doc.resolve(range.from))
  if (slice) {
    e.preventDefault()
    let tr = pm.tr.replace(range.from, range.to, slice)
    tr.setSelection(Selection.findNear(tr.doc.resolve(tr.map(range.to)), -1))
    tr.applyAndScroll()
  }
}

class Dragging {
  constructor(slice, from, to) {
    this.slice = slice
    this.from = from
    this.to = to
  }
}

function dropPos(slice, $pos) {
  if (!slice || !slice.content.size) return $pos.pos
  let content = slice.content
  for (let i = 0; i < slice.openLeft; i++) content = content.firstChild.content
  for (let d = $pos.depth; d >= 0; d--) {
    let bias = d == $pos.depth ? 0 : $pos.pos <= ($pos.start(d + 1) + $pos.end(d + 1)) / 2 ? -1 : 1
    let insertPos = $pos.index(d) + (bias > 0 ? 1 : 0)
    if ($pos.node(d).canReplace(insertPos, insertPos, content))
      return bias == 0 ? $pos.pos : bias < 0 ? $pos.before(d + 1) : $pos.after(d + 1)
  }
  return $pos.pos
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
  } else if (mouseDown && mouseDown.mightDrag) {
    let pos = mouseDown.mightDrag.pos
    dragging = {from: pos, to: pos + mouseDown.mightDrag.node.nodeSize}
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

  let mousePos = pm.posAtCoords({left: e.clientX, top: e.clientY})
  let pos = mousePos == null ? null : dropPos(pm.input.dragging && pm.input.dragging.slice, pm.doc.resolve(mousePos))
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

  if (!e.dataTransfer || pm.on.domDrop.dispatch(e)) return

  let $mouse = pm.doc.resolve(pm.posAtCoords({left: e.clientX, top: e.clientY}))
  if (!$mouse) return
  let range = insertRange($mouse, $mouse)
  let slice = dragging && dragging.slice || fromClipboard(pm, e.dataTransfer, pm.doc.resolve(range.from))
  if (!slice) return
  let insertPos = dropPos(slice, pm.doc.resolve(range.from))

  e.preventDefault()
  let tr = pm.tr
  if (dragging && !e.ctrlKey && dragging.from != null)
    tr.delete(dragging.from, dragging.to)
  let start = tr.map(insertPos), found
  tr.replace(start, tr.map(insertPos), slice).apply()

  if (slice.content.childCount == 1 && slice.openLeft == 0 && slice.openRight == 0 &&
      slice.content.child(0).type.selectable &&
      (found = pm.doc.nodeAt(start)) && found.sameMarkup(slice.content.child(0))) {
    pm.setNodeSelection(start)
  } else {
    let left = Selection.findFrom(pm.doc.resolve(start), 1, true)
    let right = Selection.findFrom(pm.doc.resolve(tr.map(insertPos)), -1, true)
    if (left && right) pm.setTextSelection(left.from, right.to)
  }
  pm.focus()
}

handlers.focus = pm => {
  pm.wrapper.classList.add("ProseMirror-focused")
  pm.on.focus.dispatch()
}

handlers.blur = pm => {
  pm.wrapper.classList.remove("ProseMirror-focused")
  pm.on.blur.dispatch()
}
