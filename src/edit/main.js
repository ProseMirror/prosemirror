import "./css"

import Keymap from "browserkeymap"

import {Pos, findDiffStart} from "../model"
import {Transform} from "../transform"
import sortedInsert from "../util/sortedinsert"
import {AssertionError} from "../util/error"
import {Map} from "../util/map"
import {eventMixin} from "../util/event"
import {requestAnimationFrame, elt, browser, ensureCSSAdded} from "../dom"

import {parseFrom, serializeTo} from "../format"

import {parseOptions, initOptions, setOption} from "./options"
import {SelectionState, TextSelection, NodeSelection,
        posAtCoords, coordsAtPos, scrollIntoView,
        findSelectionAtStart, hasFocus, SelectionError} from "./selection"
import {draw, redraw} from "./draw"
import {Input} from "./input"
import {History} from "./history"
import {RangeStore, MarkedRange} from "./range"

// ;; This is the class used to represent instances of the editor. A
// ProseMirror editor holds a [document](#Node) and a
// [selection](#Selection), and displays an editable surface
// representing that document in the browser document.
//
// Contains event methods (`on`, etc) from the [event
// mixin](#EventMixin).
export class ProseMirror {
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
    if (opts.doc == null) opts.doc = this.schema.node("doc", null, [this.schema.node("paragraph")])
    // :: DOMNode
    // The editable DOM node containing the document.
    this.content = elt("div", {class: "ProseMirror-content"})
    // :: DOMNode
    // The outer DOM element of the editor.
    this.wrapper = elt("div", {class: "ProseMirror"}, this.content)
    this.wrapper.ProseMirror = this

    if (opts.place && opts.place.appendChild)
      opts.place.appendChild(this.wrapper)
    else if (opts.place)
      opts.place(this.wrapper)

    this.setDocInner(opts.docFormat ? parseFrom(this.schema, opts.doc, opts.docFormat) : opts.doc)
    draw(this, this.doc)
    this.content.contentEditable = true
    if (opts.label)
      this.content.setAttribute("aria-label", opts.label)

    // :: Object
    // A namespace where modules can store references to themselves
    // associated with this editor instance.
    this.mod = Object.create(null)
    this.operation = null
    this.dirtyNodes = new Map // Maps node object to 1 (re-scan content) or 2 (redraw entirely)
    this.flushScheduled = false

    this.sel = new SelectionState(this)
    this.accurateSelection = false
    this.input = new Input(this)

    // :: Object<Command>
    // The commands available in the editor.
    this.commands = null
    this.commandKeys = null
    initOptions(this)
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

  // :: (Pos, ?Pos)
  // Set the selection to a [text selection](#TextSelection) from
  // `anchor` to `head`, or, if `head` is null, a cursor selection at
  // `anchor`.
  setTextSelection(anchor, head) {
    this.setSelection(new TextSelection(anchor, head))
  }

  // :: (Pos)
  // Set the selection to a node selection on the node after `pos`.
  setNodeSelection(pos) {
    this.checkPos(pos, false)
    let parent = this.doc.path(pos.path)
    if (pos.offset >= parent.size)
      SelectionError.raise("Trying to set a node selection at the end of a node")
    let node = parent.child(pos.offset)
    if (!node.type.selectable)
      SelectionError.raise("Trying to select a non-selectable node")
    this.input.maybeAbortComposition()
    this.sel.setAndSignal(new NodeSelection(pos, pos.move(1), node))
  }

  // :: (Selection)
  // Set the selection to the given selection object.
  setSelection(selection) {
    if (selection instanceof TextSelection) {
      this.checkPos(selection.head, true)
      if (!selection.empty) this.checkPos(selection.anchor, true)
    } else {
      this.checkPos(selection.to, false)
    }
    this.setSelectionDirect(selection)
  }

  setSelectionDirect(selection) {
    this.ensureOperation()
    this.input.maybeAbortComposition()
    if (!selection.eq(this.sel.range)) this.sel.setAndSignal(selection)
  }

  // :: (any, ?string)
  // Replace the editor's document. When `format` is given, it should
  // be a [parsable format](#format), and `value` should something in
  // that format. If not, `value` should be a `Node`.
  setContent(value, format) {
    if (format) value = parseFrom(this.schema, value, format)
    this.setDoc(value)
  }

  // :: (?string) → any
  // Get the editor's content in a given format. When `format` is not
  // given, a `Node` is returned. If it is given, it should be an
  // existing [serialization format](#format).
  getContent(format) {
    return format ? serializeTo(this.doc, format) : this.doc
  }

  setDocInner(doc) {
    if (doc.type != this.schema.nodes.doc)
      AssertionError.raise("Trying to set a document with a different schema")
    // :: Node The current document.
    this.doc = doc
    this.ranges = new RangeStore(this)
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
    this.sel.set(sel, true)
    // :: (doc: Node, selection: Selection) #path=ProseMirror#events#setDoc
    // Fired when [`setDoc`](#ProseMirror.setDoc) is called, after
    // the document is updated.
    this.signal("setDoc", doc, sel)
  }

  updateDoc(doc, mapping, selection) {
    this.ensureOperation()
    this.input.maybeAbortComposition()
    this.ranges.transform(mapping)
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

  // :: (Transform, ?Object) → ?Transform
  // Apply a transformation (which you might want to create with the
  // [`tr` getter](#ProseMirror.tr)) to the document in the editor.
  // The following options are supported:
  //
  // **`selection`**`: ?Selection`
  //   : A new selection to set after the transformation is applied.
  //
  // **`scrollIntoView`**: ?bool
  //   : When true, scroll the selection into view on the next
  //     [redraw](#ProseMirror.flush).
  //
  // Returns the transform, or `false` if there were no steps in it.
  //
  // Has the following property:
  apply(transform, options = nullOptions) {
    if (transform.doc == this.doc) return false
    if (transform.docs[0] != this.doc && findDiffStart(transform.docs[0], this.doc))
      AssertionError.raise("Applying a transform that does not start with the current document")

    this.updateDoc(transform.doc, transform, options.selection)
    // :: (Transform, Object) #path=ProseMirror#events#transform
    // Signals that a (non-empty) transformation has been aplied to
    // the editor. Passes the `Transform` and the options given to
    // [`apply`](#ProseMirror.apply) as arguments to the handler.
    this.signal("transform", transform, options)
    if (options.scrollIntoView) this.scrollIntoView()
    return transform
  }

  // :: (Pos, ?bool)
  // Verify that the given position is valid in the current document,
  // and throw an error otherwise. When `textblock` is true, the position
  // must also fall within a textblock node.
  checkPos(pos, textblock) {
    if (!pos.isValid(this.doc, textblock))
      AssertionError.raise("Position " + pos + " is not valid in current document")
  }

  ensureOperation() {
    return this.operation || this.startOperation()
  }

  startOperation() {
    this.sel.beforeStartOp()
    this.operation = new Operation(this)
    if (!this.flushScheduled) {
      requestAnimationFrame(() => {
        this.flushScheduled = false
        this.flush()
      })
      this.flushScheduled = true
    }
    return this.operation
  }

  // :: ()
  // Flush any pending changes to the DOM. When the document,
  // selection, or marked ranges in an editor change, the DOM isn't
  // updated immediately, but rather scheduled to be updated the next
  // time the browser redraws the screen. This method can be used to
  // force this to happen immediately. It can be useful when you, for
  // example, want to measure where on the screen a part of the
  // document ends up, immediately after changing the document.
  flush() {
    if (!document.body.contains(this.wrapper) || !this.operation) return
    // :: () #path=ProseMirror#events#flushing
    // Fired when the editor is about to [flush](#ProseMirror.flush)
    // an update to the DOM.
    this.signal("flushing")
    let op = this.operation
    if (!op) return
    this.operation = null
    this.accurateSelection = true

    let docChanged = op.doc != this.doc || this.dirtyNodes.size, redrawn = false
    if (!this.input.composing && (docChanged || op.composingAtStart)) {
      redraw(this, this.dirtyNodes, this.doc, op.doc)
      this.dirtyNodes.clear()
      redrawn = true
    }

    if ((redrawn || !op.sel.eq(this.sel.range)) && !this.input.composing || op.focus)
      this.sel.toDOM(op.focus)

    // FIXME somehow schedule this relative to ui/update so that it
    // doesn't cause extra layout
    if (op.scrollIntoView !== false)
      scrollIntoView(this, op.scrollIntoView)
    // :: () #path=ProseMirror#events#draw
    // Fired when the editor redrew its document in the DOM.
    if (docChanged) this.signal("draw")
    // :: () #path=ProseMirror#events#flush
    // Fired when the editor has finished
    // [flushing](#ProseMirror.flush) an update to the DOM.
    this.signal("flush")
    this.accurateSelection = false
  }

  // :: (Keymap, ?number)
  // Add a
  // [keymap](https://github.com/marijnh/browserkeymap#an-object-type-for-keymaps)
  // to the editor. Keymaps added in this way are queried before the
  // base keymap. The `rank` parameter can be used to
  // control when they are queried relative to other maps added like
  // this. Maps with a lower rank get queried first.
  addKeymap(map, rank = 50) {
    sortedInsert(this.input.keymaps, {map, rank}, (a, b) => a.rank - b.rank)
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

  // :: (Pos, Pos, ?Object) → MarkedRange
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
      if (to && !this.doc.path(sel.head.path).type.canContainMark(type)) return
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
      ((head = this.selection.head) ? this.doc.marksAt(head) : [])
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

  // :: ({top: number, left: number}) → ?Pos
  // If the given coordinates (which should be relative to the top
  // left corner of the window—not the page) fall within the editable
  // content, this method will return the document position that
  // corresponds to those coordinates.
  posAtCoords(coords) {
    return posAtCoords(this, coords)
  }

  // :: (Pos) → {top: number, left: number, bottom: number}
  // Find the screen coordinates (relative to top left corner of the
  // window) of the given document position.
  coordsAtPos(pos) {
    this.checkPos(pos)
    return coordsAtPos(this, pos)
  }

  // :: (?Pos)
  // Scroll the given position, or the cursor position if `pos` isn't
  // given, into view.
  scrollIntoView(pos = null) {
    if (pos) this.checkPos(pos)
    this.ensureOperation()
    this.operation.scrollIntoView = pos
  }

  // :: (string, ?[any]) → bool
  // Execute the named [command](#Command). If the command takes
  // parameters and they are not passed here, the user will be
  // prompted for them.
  execCommand(name, params) {
    let cmd = this.commands[name]
    return !!(cmd && cmd.exec(this, params) !== false)
  }

  // :: (string) → ?string
  // Return the name of the key that is bound to the given command, if
  // any.
  keyForCommand(name) {
    let cached = this.commandKeys[name]
    if (cached !== undefined) return cached

    let cmd = this.commands[name], keymap = this.input.baseKeymap
    if (!cmd) return this.commandKeys[name] = null
    let key = cmd.spec.key || (browser.mac ? cmd.spec.macKey : cmd.spec.pcKey)
    if (key) {
      key = Keymap.normalizeKeyName(Array.isArray(key) ? key[0] : key)
      let deflt = keymap.bindings[key]
      if (Array.isArray(deflt) ? deflt.indexOf(name) > -1 : deflt == name)
        return this.commandKeys[name] = key
    }
    for (let key in keymap.bindings) {
      let bound = keymap.bindings[key]
      if (Array.isArray(bound) ? bound.indexOf(name) > -1 : bound == name)
        return this.commandKeys[name] = key
    }
    return this.commandKeys[name] = null
  }

  markRangeDirty(range) {
    this.ensureOperation()
    let dirty = this.dirtyNodes
    let from = range.from, to = range.to
    for (let depth = 0, node = this.doc;; depth++) {
      let fromEnd = depth == from.depth, toEnd = depth == to.depth
      if (!fromEnd && !toEnd && from.path[depth] == to.path[depth]) {
        let child = node.child(from.path[depth])
        if (!dirty.has(child)) dirty.set(child, DIRTY_RESCAN)
        node = child
      } else {
        let start = fromEnd ? from.offset : from.path[depth]
        let end = toEnd ? to.offset : to.path[depth] + 1
        if (node.isTextblock) {
          node.forEach((child, cStart, cEnd) => {
            if (cStart < end && cEnd > start)
              dirty.set(child, DIRTY_REDRAW)
          })
        } else {
          for (let i = node.iter(start, end), child; child = i.next().value;)
            dirty.set(child, DIRTY_REDRAW)
        }
        break
      }
    }
  }
}

// :: Object
// The object `{scrollIntoView: true}`, which is a common argument to
// pass to `ProseMirror.apply` or `EditorTransform.apply`.
ProseMirror.prototype.apply.scroll = {scrollIntoView: true}

export const DIRTY_RESCAN = 1, DIRTY_REDRAW = 2

const nullOptions = {}

eventMixin(ProseMirror)

class Operation {
  constructor(pm) {
    this.doc = pm.doc
    this.sel = pm.sel.range
    this.scrollIntoView = false
    this.focus = false
    this.composingAtStart = !!pm.input.composing
  }
}

// ;; A selection-aware extension of `Transform`. Use
// `ProseMirror.tr` to create an instance.
class EditorTransform extends Transform {
  constructor(pm) {
    super(pm.doc)
    this.pm = pm
  }

  // :: (?Object) → ?EditorTransform
  // Apply the transformation. Returns the transform, or `false` it is
  // was empty.
  apply(options) {
    return this.pm.apply(this, options)
  }

  // :: Selection
  // Get the editor's current selection, [mapped](#Selection.map)
  // through the steps in this transform.
  get selection() {
    return this.steps.length ? this.pm.selection.map(this) : this.pm.selection
  }

  // :: (?Node, ?bool) → EditorTransform
  // Replace the selection with the given node, or delete it if `node`
  // is null. When `inheritMarks` is true and the node is an inline
  // node, it inherits the marks from the place where it is inserted.
  replaceSelection(node, inheritMarks) {
    let {empty, from, to, node: selNode} = this.selection, parent
    if (node && node.isInline && inheritMarks !== false) {
      let marks = empty ? this.pm.input.storedMarks : this.doc.marksAt(from)
      node = node.type.create(node.attrs, node.text, marks)
    }

    if (selNode && selNode.isTextblock && node && node.isInline) {
      // Putting inline stuff onto a selected textblock puts it inside
      from = new Pos(from.toPath(), 0)
      to = new Pos(from.path, selNode.size)
    } else if (selNode) {
      // This node can not simply be removed/replaced. Remove its parent as well
      while (from.depth && from.offset == 0 && (parent = this.doc.path(from.path)) &&
             from.offset == parent.size - 1 &&
             !parent.type.canBeEmpty && !(node && parent.type.canContain(node))) {
        from = from.shorten()
        to = to.shorten(null, 1)
      }
    } else if (node && node.isBlock && this.doc.path(from.path.slice(0, from.depth - 1)).type.canContain(node)) {
      // Inserting a block node into a textblock. Try to insert it above by splitting the textblock
      this.delete(from, to)
      let parent = this.doc.path(from.path)
      if (from.offset && from.offset != parent.size) this.split(from)
      return this.insert(from.shorten(null, from.offset ? 1 : 0), node)
    }

    if (node) return this.replaceWith(from, to, node)
    else return this.delete(from, to)
  }

  // :: () → EditorTransform
  // Delete the selection.
  deleteSelection() {
    return this.replaceSelection()
  }

  // :: (string) → EditorTransform
  // Replace the selection with a text node containing the given string.
  typeText(text) {
    return this.replaceSelection(this.pm.schema.text(text), true)
  }
}
