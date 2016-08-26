require("./css")

const {Map} = require("../util/map")
const {Subscription, PipelineSubscription, StoppableSubscription, DOMSubscription} = require("subscription")
const {requestAnimationFrame, cancelAnimationFrame, elt, ensureCSSAdded} = require("../util/dom")
const {mapThrough} = require("../transform")
const {Mark} = require("../model")

const {parseOptions} = require("./options")
const {SelectionState, TextSelection, NodeSelection, Selection, hasFocus} = require("./selection")
const {scrollIntoView, posAtCoords, coordsAtPos} = require("./dompos")
const {draw, redraw, DIRTY_REDRAW, DIRTY_RESCAN} = require("./draw")
const {Input} = require("./input")
const {RangeStore, MarkedRange} = require("./range")
const {EditorTransform} = require("./transform")
const {EditorScheduler, UpdateScheduler} = require("./update")

// ;; This is the class used to represent instances of the editor. A
// ProseMirror editor holds a [document](#Node) and a
// [selection](#Selection), and displays an editable surface
// representing that document in the browser document.
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
    this.schema = opts.schema || (opts.doc && opts.doc.type.schema)
    if (!this.schema) throw new RangeError("You must specify a schema option")
    if (opts.doc == null) opts.doc = this.schema.nodes.doc.createAndFill()
    if (opts.doc.type.schema != this.schema)
      throw new RangeError("Schema option does not correspond to schema used in doc option")
    // :: DOMNode
    // The editable DOM node containing the document.
    this.content = elt("div", {class: "ProseMirror-content", "pm-container": true})
    if (!opts.spellCheck) this.content.spellcheck = false
    // :: DOMNode
    // The outer DOM element of the editor.
    this.wrapper = elt("div", {class: "ProseMirror"}, this.content)
    this.wrapper.ProseMirror = this

    // :: Object<Subscription>
    // A wrapper object containing the various [event
    // subscriptions](https://github.com/marijnh/subscription#readme)
    // exposed by an editor instance.
    this.on = {
      // :: Subscription<()>
      // Dispatched when the document has changed. See
      // [`setDoc`](#ProseMirror.on.setDoc) and
      // [`transform`](#ProseMirror.on.transform) for more specific
      // change-related events.
      change: new Subscription,
      // :: Subscription<()>
      // Indicates that the editor's selection has changed.
      selectionChange: new Subscription,
      // :: Subscription<(text: string)>
      // Dispatched when the user types text into the editor.
      textInput: new Subscription,
      // :: Subscription<(doc: Node, selection: Selection)>
      // Dispatched when [`setDoc`](#ProseMirror.setDoc) is called, before
      // the document is actually updated.
      beforeSetDoc: new Subscription,
      // :: Subscription<(doc: Node, selection: Selection)>
      // Dispatched when [`setDoc`](#ProseMirror.setDoc) is called, after
      // the document is updated.
      setDoc: new Subscription,
      // :: Subscription<()>
      // Dispatched when the user interacts with the editor, for example by
      // clicking on it or pressing a key while it is focused. Mostly
      // useful for closing or resetting transient UI state such as open
      // menus.
      interaction: new Subscription,
      // :: Subscription<()>
      // Dispatched when the editor gains focus.
      focus: new Subscription,
      // :: Subscription<()>
      // Dispatched when the editor loses focus.
      blur: new Subscription,
      // :: StoppableSubscription<(pos: number, event: DOMEvent)>
      // Dispatched when the editor is clicked. Return a truthy
      // value to indicate that the click was handled, and no further
      // action needs to be taken.
      click: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number, node: Node, nodePos: number, event: DOMEvent)>
      // Dispatched for every node around a click in the editor, before
      // `click` is dispatched, from inner to outer nodes. `pos` is
      // the position neares to the click, `nodePos` is the position
      // directly in front of `node`.
      clickOn: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number, event: DOMEvent)>
      // Dispatched when the editor is double-clicked.
      doubleClick: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number, node: Node, nodePos: number, event: DOMEvent)>
      // Dispatched for every node around a double click in the
      // editor, before `doubleClick` is dispatched.
      doubleClickOn: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number, node: Node, event: DOMEvent)>
      // Dispatched when the context menu is opened on the editor.
      // Return a truthy value to indicate that you handled the event.
      contextMenu: new StoppableSubscription,
      // :: PipelineSubscription<(slice: Slice) → Slice>
      // Dispatched when something is pasted or dragged into the editor. The
      // given slice represents the pasted content, and your handler can
      // return a modified version to manipulate it before it is inserted
      // into the document.
      transformPasted: new PipelineSubscription,
      // :: PipelineSubscription<(text: string) → string>
      // Dispatched when plain text is pasted. Handlers must return the given
      // string or a transformed version of it.
      transformPastedText: new PipelineSubscription,
      // :: PipelineSubscription<(html: string) → string>
      // Dispatched when html content is pasted or dragged into the editor.
      // Handlers must return the given string or a transformed
      // version of it.
      transformPastedHTML: new PipelineSubscription,
      // :: Subscription<(transform: Transform, selectionBeforeTransform: Selection, options: Object)>
      // Signals that a (non-empty) transformation has been aplied to
      // the editor. Passes the `Transform`, the selection before the
      // transform, and the options given to [`apply`](#ProseMirror.apply)
      // as arguments to the handler.
      transform: new Subscription,
      // :: Subscription<(transform: Transform, options: Object)>
      // Indicates that the given transform is about to be
      // [applied](#ProseMirror.apply). The handler may add additional
      // [steps](#Step) to the transform, but it it not allowed to
      // interfere with the editor's state.
      beforeTransform: new Subscription,
      // :: StoppableSubscription<(transform: Transform)>
      // Dispatched before a transform (applied without `filter: false`) is
      // applied. The handler can return a truthy value to cancel the
      // transform.
      filterTransform: new StoppableSubscription,
      // :: Subscription<()>
      // Dispatched when the editor is about to [flush](#ProseMirror.flush)
      // an update to the DOM.
      flushing: new Subscription,
      // :: Subscription<()>
      // Dispatched when the editor has finished
      // [flushing](#ProseMirror.flush) an update to the DOM.
      flush: new Subscription,
      // :: Subscription<()>
      // Dispatched when the editor redrew its document in the DOM.
      draw: new Subscription,
      // :: Subscription<()>
      // Dispatched when the set of [active marks](#ProseMirror.activeMarks) changes.
      activeMarkChange: new Subscription,
      // :: StoppableSubscription<(DOMEvent)>
      // Dispatched when a DOM `paste` event happens on the editor.
      // Handlers may declare the event as being handled by calling
      // `preventDefault` on it or returning a truthy value.
      domPaste: new DOMSubscription,
      // :: StoppableSubscription<(DOMEvent)>
      // Dispatched when a DOM `drop` event happens on the editor.
      // Handlers may declare the event as being handled by calling
      // `preventDefault` on it or returning a truthy value.
      domDrop: new DOMSubscription
    }

    if (opts.place && opts.place.appendChild)
      opts.place.appendChild(this.wrapper)
    else if (opts.place)
      opts.place(this.wrapper)

    this._root = null

    this.setDocInner(opts.doc)
    draw(this, this.doc)
    this.content.contentEditable = true
    if (opts.label)
      this.content.setAttribute("aria-label", opts.label)

    // A namespace where plugins can store their state. See the `Plugin` class.
    this.plugin = Object.create(null)
    this.cached = Object.create(null)

    // :: History A property into which a [history
    // plugin](#historyPlugin) may put a history implementation.
    this.history = null

    this.operation = null
    this.dirtyNodes = new Map // Maps node object to 1 (re-scan content) or 2 (redraw entirely)
    this.flushScheduled = null
    this.centralScheduler = new EditorScheduler(this)

    this.sel = new SelectionState(this, Selection.findAtStart(this.doc))
    this.accurateSelection = false
    this.input = new Input(this)
    this.options.keymaps.forEach(map => this.addKeymap(map, -100))

    this.options.plugins.forEach(plugin => plugin.attach(this))
  }

  // :: DOMDocument
  // The root document that the editor is part of. Initialized lazily
  // (falling back to the top-level document until the editor is
  // placed in the DOM) to make sure asynchronously adding the editor
  // to a shadow DOM works correctly.
  get root() {
    let cached = this._root
    if (cached == null) for (let search = this.wrapper.parentNode; search; search = search.parentNode) {
      if (search.nodeType == 9 || (search.nodeType == 11 && search.host))
        return this._root = search
    }
    return cached || document
  }

  // :: (string) → any
  // Get the value of the given [option](#edit_options).
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
    let $anchor = this.doc.resolve(anchor), $head = this.doc.resolve(head)
    if (!$anchor.parent.isTextblock || !$head.parent.isTextblock)
      throw new RangeError("Setting text selection with an end not in a textblock")
    this.setSelection(new TextSelection($anchor, $head))
  }

  // :: (number)
  // Set the selection to a node selection on the node after `pos`.
  setNodeSelection(pos) {
    let $pos = this.doc.resolve(pos), node = $pos.nodeAfter
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
  }

  // :: (Node, ?Selection)
  // Set the editor's content, and optionally include a new selection.
  setDoc(doc, sel) {
    if (!sel) sel = Selection.findAtStart(doc)
    this.on.beforeSetDoc.dispatch(doc, sel)
    this.ensureOperation()
    this.setDocInner(doc)
    this.operation.docSet = true
    this.sel.set(sel, true)
    this.on.setDoc.dispatch(doc, sel)
  }

  updateDoc(doc, mapping, selection) {
    this.ensureOperation()
    this.ranges.transform(mapping)
    this.operation.mappings.push(mapping)
    this.doc = doc
    this.sel.setAndSignal(selection || this.sel.range.map(doc, mapping))
    this.on.change.dispatch()
  }

  // :: EditorTransform
  // Create an editor- and selection-aware `Transform` object for this
  // editor.
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
  //     If `transform` is an `EditorTransform`, this will default to
  //     that object's current selection. If no selection is provided,
  //     the new selection is determined by [mapping](#Selection.map)
  //     the existing selection through the transform.
  //
  // **`filter`**: ?bool
  //   : When set to false, suppresses the ability of the
  //     [`filterTransform` event](#ProseMirror.on.filterTransform)
  //     to cancel this transform.
  //
  // Returns the transform itself.
  apply(transform, options = nullOptions) {
    if (!transform.steps.length) return transform
    if (!transform.docs[0].eq(this.doc))
      throw new RangeError("Applying a transform that does not start with the current document")

    if (options.filter !== false && this.on.filterTransform.dispatch(transform))
      return transform

    let selectionBeforeTransform = this.selection

    this.on.beforeTransform.dispatch(transform, options)
    this.updateDoc(transform.doc, transform, options.selection || transform.selection)
    this.on.transform.dispatch(transform, selectionBeforeTransform, options)
    if (options.scrollIntoView) this.scrollIntoView()
    return transform
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

    if (!this.root.contains(this.wrapper) || !this.operation) return false
    this.on.flushing.dispatch()

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
    if (redrawn) this.on.draw.dispatch()
    this.on.flush.dispatch()
    this.accurateSelection = false
    return redrawn
  }

  // :: (Keymap, ?number)
  // Add a
  // [keymap](https://github.com/marijnh/browserkeymap#an-object-type-for-keymaps)
  // to the editor. Keymaps added in this way are queried before the
  // base keymap. The `priority` parameter can be used to
  // control when they are queried relative to other maps added like
  // this. Maps with a higher priority get queried first.
  addKeymap(map, priority = 0) {
    let i = 0, maps = this.input.keymaps
    for (; i < maps.length; i++) if (maps[i].priority < priority) break
    maps.splice(i, 0, {map, priority})
  }

  // :: (Keymap)
  // Remove the given keymap from the editor.
  removeKeymap(map) {
    let maps = this.input.keymaps
    for (let i = 0; i < maps.length; ++i) if (maps[i].map == map) {
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
  // The `options` parameter may be an object containing these properties:
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
  // **`className`**`: string`
  //   : A CSS class to add to the inline content that is part of this
  //     range.
  //
  // **`onRemove`**`: fn(number, number)`
  //   : When given, this function will be called when the range is
  //     removed from the editor.
  markRange(from, to, options) {
    let range = new MarkedRange(from, to, options)
    this.ranges.addRange(range)
    return range
  }

  // :: (MarkedRange)
  // Remove the given range from the editor.
  removeRange(range) {
    this.ranges.removeRange(range)
  }

  // :: () → [Mark]
  // Get the marks at the cursor. By default, this yields the marks
  // associated with the content at the cursor, as per `Node.marksAt`.
  // But if the set of active marks was updated with
  // [`addActiveMark`](#ProseMirror.addActiveMark) or
  // [`removeActiveMark`](#ProseMirror.removeActiveMark), the updated
  // set is returned.
  activeMarks() {
    return this.input.storedMarks || currentMarks(this)
  }

  // :: (Mark)
  // Add a mark to the set of overridden active marks that will be
  // applied to subsequently typed text. Does not do anything when the
  // selection isn't collapsed.
  addActiveMark(mark) {
    if (this.selection.empty) {
      this.input.storedMarks = mark.addToSet(this.input.storedMarks || currentMarks(this))
      this.on.activeMarkChange.dispatch()
    }
  }

  // :: (MarkType)
  // Remove any mark of the given type from the set of overidden active marks.
  removeActiveMark(markType) {
    if (this.selection.empty) {
      this.input.storedMarks = markType.removeFromSet(this.input.storedMarks || currentMarks(this))
      this.on.activeMarkChange.dispatch()
    }
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
      return this.root.activeElement == this.content
    else
      return hasFocus(this)
  }

  // :: ({top: number, left: number}) → ?number
  // If the given coordinates (which should be relative to the top
  // left corner of the window—not the page) fall within the editable
  // content, this method will return the document position that
  // corresponds to those coordinates.
  posAtCoords(coords) {
    let result = mappedPosAtCoords(this, coords)
    return result && result.pos
  }

  // :: ({top: number, left: number}) → ?{pos: number, inside: [{pos: number, node: Node}]}
  // If the given coordinates fall within the editable content, this
  // method will return the document position that corresponds to
  // those coordinates, along with a stack of nodes and their
  // positions (excluding the top node) that the coordinates fall
  // into.
  contextAtCoords(coords) {
    let result = mappedPosAtCoords(this, coords)
    if (!result) return null

    let $pos = this.doc.resolve(result.inLeaf == -1 ? result.pos : result.inLeaf), inside = []
    for (let i = 1; i <= $pos.depth; i++)
      inside.push({pos: $pos.before(i), node: $pos.node(i)})
    if (result.inLeaf > -1) {
      let after = $pos.nodeAfter
      if (after && !after.isText && after.type.isLeaf)
        inside.push({pos: result.inLeaf, node: after})
    }
    return {pos: result.pos, inside}
  }

  // :: (number) → {top: number, left: number, bottom: number}
  // Find the screen coordinates (relative to top left corner of the
  // window) of the given document position.
  coordsAtPos(pos) {
    this.flush()
    return coordsAtPos(this, pos)
  }

  // :: (?number)
  // Scroll the given position, or the cursor position if `pos` isn't
  // given, into view.
  scrollIntoView(pos = null) {
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
  // Return a translated string, if a [translate function](#translate)
  // has been supplied, or the original string.
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

  // :: ([Subscription], () -> ?()) → UpdateScheduler
  // Creates an update scheduler for this editor. `subscriptions`
  // should be an array of subscriptions to listen for. `start` should
  // be a function as expected by
  // [`scheduleDOMUpdate`](#ProseMirror.scheduleDOMUpdate).
  updateScheduler(subscriptions, start) {
    return new UpdateScheduler(this, subscriptions, start)
  }
}
exports.ProseMirror = ProseMirror

function mappedPosAtCoords(pm, coords) {
  // If the DOM has been changed, flush so that we have a proper DOM to read
  if (pm.operation && (pm.dirtyNodes.size > 0 || pm.operation.composing || pm.operation.docSet))
    pm.flush()
  let result = posAtCoords(pm, coords)
  if (!result) return null

  // If there's an active operation, we need to map forward through
  // its changes to get a position that applies to the current
  // document
  if (pm.operation)
    return {pos: mapThrough(pm.operation.mappings, result.pos),
            inLeaf: result.inLeaf < 0 ? null : mapThrough(pm.operation.mappings, result.inLeaf)}
  else
    return result
}

function currentMarks(pm) {
  let head = pm.selection.head
  return head == null ? Mark.none : pm.doc.marksAt(head)
}

const nullOptions = {}

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
