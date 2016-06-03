require("./css")

const {Map} = require("../util/map")
const {eventMixin} = require("../util/event")
const {requestAnimationFrame, cancelAnimationFrame, elt, ensureCSSAdded} = require("../util/dom")

const {parseOptions, initOptions, setOption} = require("./options")
const {SelectionState, TextSelection, NodeSelection, findSelectionAtStart, hasFocus} = require("./selection")
const {scrollIntoView, posAtCoords, coordsAtPos} = require("./dompos")
const {draw, redraw, DIRTY_REDRAW, DIRTY_RESCAN} = require("./draw")
const {Input} = require("./input")
const {History} = require("./history")
const {RangeStore, MarkedRange} = require("./range")
const {EditorTransform} = require("./transform")
const {EditorScheduler, UpdateScheduler} = require("./update")

// ;; This is the class used to represent instances of the editor. A
// ProseMirror editor holds a [document](#Node) and a
// [selection](#Selection), and displays an editable surface
// representing that document in the browser document.
//
// Contains event methods (`on`, etc) from the [event
// mixin](#EventMixin).
class ProseMirror {
  // :: (Object)
  // Construct a new editor from a set of [options](#edit_options)
  // and, if it has a [`place`](#place) option, add it to the
  // document.
  constructor(opts) {
    ensureCSSAdded()

    opts = this.options = parseOptions(opts)
    // :: Schema
    // The schema for this editor's document.
    this.schema = opts.schema
    if (!this.schema) throw new RangeError("You must specify a schema option")
    if (opts.doc == null) opts.doc = this.schema.nodes.doc.createAndFill()
    // :: DOMNode
    // The editable DOM node containing the document.
    this.content = elt("div", {class: "ProseMirror-content", "pm-container": true})
    // :: DOMNode
    // The outer DOM element of the editor.
    this.wrapper = elt("div", {class: "ProseMirror"}, this.content)
    this.wrapper.ProseMirror = this

    if (opts.place && opts.place.appendChild)
      opts.place.appendChild(this.wrapper)
    else if (opts.place)
      opts.place(this.wrapper)

    this.setDocInner(opts.doc)
    draw(this, this.doc)
    this.content.contentEditable = true
    if (opts.label)
      this.content.setAttribute("aria-label", opts.label)

    // A namespace where plugins can store their state. See the `Plugin` class.
    this.plugin = Object.create(null)
    this.cached = Object.create(null)
    this.operation = null
    this.dirtyNodes = new Map // Maps node object to 1 (re-scan content) or 2 (redraw entirely)
    this.flushScheduled = null
    this.centralScheduler = new EditorScheduler(this)

    this.sel = new SelectionState(this, findSelectionAtStart(this.doc))
    this.accurateSelection = false
    this.input = new Input(this)

    initOptions(this)
    this.options.plugins.forEach(plugin => plugin.attach(this))
  }

  // :: (string, any)
  // Update the value of the given [option](#edit_options).
  setOption(name, value) {
    setOption(this, name, value)
    // :: (name: string, value: *) #path=ProseMirror#events#optionChanged
    // Fired when [`setOption`](#ProseMirror.setOption) is called.
    this.signal("optionChanged", name, value)
  }

  // :: (string) → any
  // Get the current value of the given [option](#edit_options).
  getOption(name) { return this.options[name] }

  // :: Selection
  // Get the current selection.
  get selection() {
    if (!this.accurateSelection) this.ensureOperation()
    return this.sel.range
  }

  // :: (number, ?number)
  // Set the selection to a [text selection](#TextSelection) from
  // `anchor` to `head`, or, if `head` is null, a cursor selection at
  // `anchor`.
  setTextSelection(anchor, head = anchor) {
    let $head = this.checkPos(head, true)
    let $anchor = anchor != head ? this.checkPos(anchor, true) : $head
    this.setSelection(new TextSelection($anchor, $head))
  }

  // :: (number)
  // Set the selection to a node selection on the node after `pos`.
  setNodeSelection(pos) {
    let $pos = this.checkPos(pos, false), node = $pos.nodeAfter
    if (!node || !node.type.selectable)
      throw new RangeError("Trying to create a node selection that doesn't point at a selectable node")
    this.setSelection(new NodeSelection($pos))
  }

  // :: (Selection)
  // Set the selection to the given selection object.
  setSelection(selection) {
    this.ensureOperation()
    if (!selection.eq(this.sel.range)) this.sel.setAndSignal(selection)
  }

  setDocInner(doc) {
    if (doc.type != this.schema.nodes.doc)
      throw new RangeError("Trying to set a document with a different schema")
    // :: Node The current document.
    this.doc = doc
    this.ranges = new RangeStore(this)
    // :: History The edit history for the editor.
    this.history = new History(this)
  }

  // :: (Node, ?Selection)
  // Set the editor's content, and optionally include a new selection.
  setDoc(doc, sel) {
    if (!sel) sel = findSelectionAtStart(doc)
    // :: (doc: Node, selection: Selection) #path=ProseMirror#events#beforeSetDoc
    // Fired when [`setDoc`](#ProseMirror.setDoc) is called, before
    // the document is actually updated.
    this.signal("beforeSetDoc", doc, sel)
    this.ensureOperation()
    this.setDocInner(doc)
    this.operation.docSet = true
    this.sel.set(sel, true)
    // :: (doc: Node, selection: Selection) #path=ProseMirror#events#setDoc
    // Fired when [`setDoc`](#ProseMirror.setDoc) is called, after
    // the document is updated.
    this.signal("setDoc", doc, sel)
  }

  updateDoc(doc, mapping, selection) {
    this.ensureOperation()
    this.ranges.transform(mapping)
    this.operation.mappings.push(mapping)
    this.doc = doc
    this.sel.setAndSignal(selection || this.sel.range.map(doc, mapping))
    // :: () #path=ProseMirror#events#change
    // Fired when the document has changed. See
    // [`setDoc`](#ProseMirror.event_setDoc) and
    // [`transform`](#ProseMirror.event_transform) for more specific
    // change-related events.
    this.signal("change")
  }

  // :: EditorTransform
  // Create an editor- and selection-aware `Transform` for this editor.
  get tr() { return new EditorTransform(this) }

  // :: (Transform, ?Object) → Transform
  // Apply a transformation (which you might want to create with the
  // [`tr` getter](#ProseMirror.tr)) to the document in the editor.
  // The following options are supported:
  //
  // **`scrollIntoView`**: ?bool
  //   : When true, scroll the selection into view on the next
  //     [redraw](#ProseMirror.flush).
  //
  // **`selection`**`: ?Selection`
  //   : A new selection to set after the transformation is applied.
  //
  // **`filter`**: ?bool
  //   : When set to false, suppresses the ability of the
  //     [`"filterTransform"` event](#ProseMirror.event_beforeTransform)
  //     to cancel this transform.
  //
  // Returns the transform itself.
  apply(transform, options = nullOptions) {
    if (!transform.steps.length) return transform
    if (!transform.docs[0].eq(this.doc))
      throw new RangeError("Applying a transform that does not start with the current document")

    // :: (transform: Transform) #path=ProseMirror#events#filterTransform
    // Fired before a transform (applied without `filter: false`) is
    // applied. The handler can return a truthy value to cancel the
    // transform.
    if (options.filter !== false && this.signalHandleable("filterTransform", transform))
      return transform

    let selectionBeforeTransform = this.selection

    // :: (transform: Transform, options: Object) #path=ProseMirror#events#beforeTransform
    // Indicates that the given transform is about to be
    // [applied](#ProseMirror.apply). The handler may add additional
    // [steps](#Step) to the transform, but it it not allowed to
    // interfere with the editor's state.
    this.signal("beforeTransform", transform, options)
    this.updateDoc(transform.doc, transform, options.selection || transform.selection)
    // :: (transform: Transform, selectionBeforeTransform: Selection, options: Object) #path=ProseMirror#events#transform
    // Signals that a (non-empty) transformation has been aplied to
    // the editor. Passes the `Transform`, the selection before the
    // transform, and the options given to [`apply`](#ProseMirror.apply)
    // as arguments to the handler.
    this.signal("transform", transform, selectionBeforeTransform, options)
    if (options.scrollIntoView) this.scrollIntoView()
    return transform
  }

  // :: (number, ?bool)
  // Verify that the given position is valid in the current document,
  // and throw an error otherwise. When `textblock` is true, the position
  // must also fall within a textblock node.
  checkPos(pos, textblock) {
    if (pos < 0 || pos > this.doc.content.size)
      throw new RangeError("Position " + pos + " is outside of the document")
    let $pos = this.doc.resolve(pos)
    if (textblock && !$pos.parent.isTextblock)
      throw new RangeError("Position " + pos + " does not point into a textblock")
    return $pos
  }

  // : (?Object) → Operation
  // Ensure that an operation has started.
  ensureOperation(options) {
    return this.operation || this.startOperation(options)
  }

  // : (?Object) → Operation
  // Start an operation and schedule a flush so that any effect of
  // the operation shows up in the DOM.
  startOperation(options) {
    this.operation = new Operation(this, options)
    if (!(options && options.readSelection === false) && this.sel.readFromDOM())
      this.operation.sel = this.sel.range

    if (this.flushScheduled == null)
      this.flushScheduled = requestAnimationFrame(() => this.flush())
    return this.operation
  }

  // Cancel any scheduled operation flush.
  unscheduleFlush() {
    if (this.flushScheduled != null) {
      cancelAnimationFrame(this.flushScheduled)
      this.flushScheduled = null
    }
  }

  // :: () → bool
  // Flush any pending changes to the DOM. When the document,
  // selection, or marked ranges in an editor change, the DOM isn't
  // updated immediately, but rather scheduled to be updated the next
  // time the browser redraws the screen. This method can be used to
  // force this to happen immediately. It can be useful when you, for
  // example, want to measure where on the screen a part of the
  // document ends up, immediately after changing the document.
  //
  // Returns true when it updated the document DOM.
  flush() {
    this.unscheduleFlush()

    if (!document.body.contains(this.wrapper) || !this.operation) return false
    // :: () #path=ProseMirror#events#flushing
    // Fired when the editor is about to [flush](#ProseMirror.flush)
    // an update to the DOM.
    this.signal("flushing")

    let op = this.operation, redrawn = false
    if (!op) return false
    if (op.composing) this.input.applyComposition()

    this.operation = null
    this.accurateSelection = true

    if (op.doc != this.doc || this.dirtyNodes.size) {
      redraw(this, this.dirtyNodes, this.doc, op.doc)
      this.dirtyNodes.clear()
      redrawn = true
    }

    if ((redrawn || !op.sel.eq(this.sel.range)) || op.focus)
      this.sel.toDOM(op.focus)

    // FIXME somehow schedule this relative to ui/update so that it
    // doesn't cause extra layout
    if (op.scrollIntoView !== false)
      scrollIntoView(this, op.scrollIntoView)
    // :: () #path=ProseMirror#events#draw
    // Fired when the editor redrew its document in the DOM.
    if (redrawn) this.signal("draw")
    // :: () #path=ProseMirror#events#flush
    // Fired when the editor has finished
    // [flushing](#ProseMirror.flush) an update to the DOM.
    this.signal("flush")
    this.accurateSelection = false
    return redrawn
  }

  // :: (Keymap, ?number)
  // Add a
  // [keymap](https://github.com/marijnh/browserkeymap#an-object-type-for-keymaps)
  // to the editor. Keymaps added in this way are queried before the
  // base keymap. The `rank` parameter can be used to
  // control when they are queried relative to other maps added like
  // this. Maps with a lower rank get queried first.
  addKeymap(map, rank = 50) {
    let i = 0, maps = this.input.keymaps
    for (; i < maps.length; i++) if (maps[i].rank > rank) break
    maps.splice(i, 0, {map, rank})
  }

  // :: (union<string, Keymap>)
  // Remove the given keymap, or the keymap with the given name, from
  // the editor.
  removeKeymap(map) {
    let maps = this.input.keymaps
    for (let i = 0; i < maps.length; ++i) if (maps[i].map == map || maps[i].map.options.name == map) {
      maps.splice(i, 1)
      return true
    }
  }

  // :: (number, number, ?Object) → MarkedRange
  // Create a marked range between the given positions. Marked ranges
  // “track” the part of the document they point to—as the document
  // changes, they are updated to move, grow, and shrink along with
  // their content.
  //
  // `options` may be an object containing these properties:
  //
  // **`inclusiveLeft`**`: bool = false`
  //   : Whether the left side of the range is inclusive. When it is,
  //     content inserted at that point will become part of the range.
  //     When not, it will be outside of the range.
  //
  // **`inclusiveRight`**`: bool = false`
  //   : Whether the right side of the range is inclusive.
  //
  // **`removeWhenEmpty`**`: bool = true`
  //   : Whether the range should be forgotten when it becomes empty
  //     (because all of its content was deleted).
  //
  // **`className`**: string
  //   : A CSS class to add to the inline content that is part of this
  //     range.
  markRange(from, to, options) {
    this.checkPos(from)
    this.checkPos(to)
    let range = new MarkedRange(from, to, options)
    this.ranges.addRange(range)
    return range
  }

  // :: (MarkedRange)
  // Remove the given range from the editor.
  removeRange(range) {
    this.ranges.removeRange(range)
  }

  // :: (MarkType, ?bool, ?Object)
  // Set (when `to` is true), unset (`to` is false), or toggle (`to`
  // is null) the given mark type on the selection. When there is a
  // non-empty selection, the marks of the selection are updated. When
  // the selection is empty, the set of [active
  // marks](#ProseMirror.activeMarks) is updated.
  setMark(type, to, attrs) {
    let sel = this.selection
    if (sel.empty) {
      let marks = this.activeMarks()
      if (to == null) to = !type.isInSet(marks)
      if (to && !sel.$head.parent.contentMatchAt(sel.$head.index()).allowsMark(type)) return
      this.input.storedMarks = to ? type.create(attrs).addToSet(marks) : type.removeFromSet(marks)
      // :: () #path=ProseMirror#events#activeMarkChange
      // Fired when the set of [active marks](#ProseMirror.activeMarks) changes.
      this.signal("activeMarkChange")
    } else {
      if (to != null ? to : !this.doc.rangeHasMark(sel.from, sel.to, type))
        this.apply(this.tr.addMark(sel.from, sel.to, type.create(attrs)))
      else
        this.apply(this.tr.removeMark(sel.from, sel.to, type))
    }
  }

  // :: () → [Mark]
  // Get the marks at the cursor. By default, this yields the marks
  // associated with the content at the cursor, as per `Node.marksAt`.
  // But `setMark` may have been used to change the set of active
  // marks, in which case that set is returned.
  activeMarks() {
    var head
    return this.input.storedMarks ||
      ((head = this.selection.head) != null ? this.doc.marksAt(head) : [])
  }

  // :: ()
  // Give the editor focus.
  focus() {
    if (this.operation) this.operation.focus = true
    else this.sel.toDOM(true)
  }

  // :: () → bool
  // Query whether the editor has focus.
  hasFocus() {
    if (this.sel.range instanceof NodeSelection)
      return document.activeElement == this.content
    else
      return hasFocus(this)
  }

  // :: ({top: number, left: number}) → ?number
  // If the given coordinates (which should be relative to the top
  // left corner of the window—not the page) fall within the editable
  // content, this method will return the document position that
  // corresponds to those coordinates.
  posAtCoords(coords) {
    this.flush()
    return posAtCoords(this, coords)
  }

  // :: (number) → {top: number, left: number, bottom: number}
  // Find the screen coordinates (relative to top left corner of the
  // window) of the given document position.
  coordsAtPos(pos) {
    this.checkPos(pos)
    this.flush()
    return coordsAtPos(this, pos)
  }

  // :: (?number)
  // Scroll the given position, or the cursor position if `pos` isn't
  // given, into view.
  scrollIntoView(pos = null) {
    if (pos) this.checkPos(pos)
    this.ensureOperation()
    this.operation.scrollIntoView = pos
  }

  markRangeDirty(from, to, doc = this.doc) {
    this.ensureOperation()
    let dirty = this.dirtyNodes
    let $from = doc.resolve(from), $to = doc.resolve(to)
    let same = $from.sameDepth($to)
    for (let depth = 0; depth <= same; depth++) {
      let child = $from.node(depth)
      if (!dirty.has(child)) dirty.set(child, DIRTY_RESCAN)
    }
    let start = $from.index(same), end = $to.index(same) + (same == $to.depth && $to.atNodeBoundary ? 0 : 1)
    let parent = $from.node(same)
    for (let i = start; i < end; i++)
      dirty.set(parent.child(i), DIRTY_REDRAW)
  }

  markAllDirty() {
    this.dirtyNodes.set(this.doc, DIRTY_REDRAW)
  }

  // :: (string) → string
  // Return a translated string, if a translate function has been supplied,
  // or the original string.
  translate(string) {
    let trans = this.options.translate
    return trans ? trans(string) : string
  }

  // :: (() -> ?() -> ?())
  // Schedule a DOM update function to be called either the next time
  // the editor is [flushed](#ProseMirror.flush), or if no flush happens
  // immediately, after 200 milliseconds. This is used to synchronize
  // DOM updates and read to prevent [DOM layout
  // thrashing](http://eloquentjavascript.net/13_dom.html#p_nnTb9RktUT).
  //
  // Often, your updates will need to both read and write from the DOM.
  // To schedule such access in lockstep with other modules, the
  // function you give can return another function, which may return
  // another function, and so on. The first call should _write_ to the
  // DOM, and _not read_. If a _read_ needs to happen, that should be
  // done in the function returned from the first call. If that has to
  // be followed by another _write_, that should be done in a function
  // returned from the second function, and so on.
  scheduleDOMUpdate(f) { this.centralScheduler.set(f) }

  // :: (() -> ?() -> ?())
  // Cancel an update scheduled with `scheduleDOMUpdate`. Calling this
  // with a function that is not actually scheduled is harmless.
  unscheduleDOMUpdate(f) { this.centralScheduler.unset(f) }

  // :: (string, () -> ?()) → UpdateScheduler
  // Creates an update scheduler for this given editor. `events` should
  // be a space-separated list of event names (for example
  // `"selectionChange change"`). `start` should be a function as
  // expected by [`scheduleDOMUpdate`](ProseMirror.scheduleDOMUpdate).
  updateScheduler(events, start) {
    return new UpdateScheduler(this, events, start)
  }
}
exports.ProseMirror = ProseMirror

const nullOptions = {}

eventMixin(ProseMirror)

// Operations are used to delay/batch DOM updates. When a change to
// the editor state happens, it is not immediately flushed to the DOM,
// but rather a call to `ProseMirror.flush` is scheduled using
// `requestAnimationFrame`. An object of this class is stored in the
// editor's `operation` property, and holds information about the
// state at the start of the operation, which can be used to determine
// the minimal DOM update needed. It also stores information about
// whether a focus needs to happen on flush, and whether something
// needs to be scrolled into view.
class Operation {
  constructor(pm, options) {
    this.doc = pm.doc
    this.docSet = false
    this.sel = (options && options.selection) || pm.sel.range
    this.scrollIntoView = false
    this.focus = false
    this.mappings = []
    this.composing = null
  }
}
