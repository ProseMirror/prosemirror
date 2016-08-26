const {contains} = require("../util/dom")
const browser = require("../util/browser")

const {posFromDOM, DOMAfterPos, DOMFromPos, coordsAtPos} = require("./dompos")

// Track the state of the current editor selection. Keeps the editor
// selection in sync with the DOM selection by polling for changes,
// as there is no DOM event for DOM selection changes.
class SelectionState {
  constructor(pm, range) {
    this.pm = pm
    // The current editor selection.
    this.range = range

    // The timeout ID for the poller when active.
    this.polling = null
    // Track the state of the DOM selection.
    this.lastAnchorNode = this.lastHeadNode = this.lastAnchorOffset = this.lastHeadOffset = null
    // The corresponding DOM node when a node selection is active.
    this.lastNode = null

    pm.content.addEventListener("focus", () => this.receivedFocus())

    this.poller = this.poller.bind(this)
  }

  // : (Selection, boolean)
  // Set the current selection and signal an event on the editor.
  setAndSignal(range, clearLast) {
    this.set(range, clearLast)
    this.pm.on.selectionChange.dispatch()
  }

  // : (Selection, boolean)
  // Set the current selection.
  set(range, clearLast) {
    this.pm.ensureOperation({readSelection: false, selection: range})
    this.range = range
    if (clearLast !== false) this.lastAnchorNode = null
  }

  poller() {
    if (hasFocus(this.pm)) {
      if (!this.pm.operation) this.readFromDOM()
      this.polling = setTimeout(this.poller, 100)
    } else {
      this.polling = null
    }
  }

  startPolling() {
    clearTimeout(this.polling)
    this.polling = setTimeout(this.poller, 50)
  }

  fastPoll() {
    this.startPolling()
  }

  stopPolling() {
    clearTimeout(this.polling)
    this.polling = null
  }

  // : () → bool
  // Whether the DOM selection has changed from the last known state.
  domChanged() {
    let sel = this.pm.root.getSelection()
    return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
      sel.focusNode != this.lastHeadNode || sel.focusOffset != this.lastHeadOffset
  }

  // Store the current state of the DOM selection.
  storeDOMState() {
    let sel = this.pm.root.getSelection()
    this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset
    this.lastHeadNode = sel.focusNode; this.lastHeadOffset = sel.focusOffset
  }

  // : () → bool
  // When the DOM selection changes in a notable manner, modify the
  // current selection state to match.
  readFromDOM() {
    if (!hasFocus(this.pm) || !this.domChanged()) return false

    let {range, adjusted} = selectionFromDOM(this.pm, this.range.head)
    this.setAndSignal(range)

    if (range instanceof NodeSelection || adjusted) {
      this.toDOM()
    } else {
      this.clearNode()
      this.storeDOMState()
    }
    return true
  }

  toDOM(takeFocus) {
    if (!hasFocus(this.pm)) {
      if (!takeFocus) return
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=921444
      else if (browser.gecko) this.pm.content.focus()
    }
    if (this.range instanceof NodeSelection)
      this.nodeToDOM()
    else
      this.rangeToDOM()
  }

  // Make changes to the DOM for a node selection.
  nodeToDOM() {
    let dom = DOMAfterPos(this.pm, this.range.from)
    if (dom != this.lastNode) {
      this.clearNode()
      dom.classList.add("ProseMirror-selectednode")
      this.pm.content.classList.add("ProseMirror-nodeselection")
      this.lastNode = dom
    }
    let range = document.createRange(), sel = this.pm.root.getSelection()
    range.selectNode(dom)
    sel.removeAllRanges()
    sel.addRange(range)
    this.storeDOMState()
  }

  // Make changes to the DOM for a text selection.
  rangeToDOM() {
    this.clearNode()

    let anchor = DOMFromPos(this.pm, this.range.anchor)
    let head = DOMFromPos(this.pm, this.range.head)

    let sel = this.pm.root.getSelection(), range = document.createRange()
    if (sel.extend) {
      range.setEnd(anchor.node, anchor.offset)
      range.collapse(false)
    } else {
      if (this.range.anchor > this.range.head) { let tmp = anchor; anchor = head; head = tmp }
      range.setEnd(head.node, head.offset)
      range.setStart(anchor.node, anchor.offset)
    }
    sel.removeAllRanges()
    sel.addRange(range)
    if (sel.extend)
      sel.extend(head.node, head.offset)
    this.storeDOMState()
  }

  // Clear all DOM statefulness of the last node selection.
  clearNode() {
    if (this.lastNode) {
      this.lastNode.classList.remove("ProseMirror-selectednode")
      this.pm.content.classList.remove("ProseMirror-nodeselection")
      this.lastNode = null
      return true
    }
  }

  receivedFocus() {
    if (this.polling == null) this.startPolling()
  }
}
exports.SelectionState = SelectionState

// ;; An editor selection. Can be one of two selection types:
// `TextSelection` or `NodeSelection`. Both have the properties
// listed here, but also contain more information (such as the
// selected [node](#NodeSelection.node) or the
// [head](#TextSelection.head) and [anchor](#TextSelection.anchor)).
class Selection {
  // :: number
  // The left bound of the selection.
  get from() { return this.$from.pos }

  // :: number
  // The right bound of the selection.
  get to() { return this.$to.pos }

  constructor($from, $to) {
    // :: ResolvedPos
    // The resolved left bound of the selection
    this.$from = $from
    // :: ResolvedPos
    // The resolved right bound of the selection
    this.$to = $to
  }

  // :: bool
  // True if the selection is an empty text selection (head an anchor
  // are the same).
  get empty() {
    return this.from == this.to
  }

  // :: (other: Selection) → bool #path=Selection.prototype.eq
  // Test whether the selection is the same as another selection.

  // :: (doc: Node, mapping: Mappable) → Selection #path=Selection.prototype.map
  // Map this selection through a [mappable](#Mappable) thing. `doc`
  // should be the new document, to which we are mapping.

  // :: (ResolvedPos, number, ?bool) → ?Selection
  // Find a valid cursor or leaf node selection starting at the given
  // position and searching back if `dir` is negative, and forward if
  // negative. When `textOnly` is true, only consider cursor
  // selections.
  static findFrom($pos, dir, textOnly) {
    let inner = $pos.parent.isTextblock ? new TextSelection($pos)
        : findSelectionIn($pos.node(0), $pos.parent, $pos.pos, $pos.index(), dir, textOnly)
    if (inner) return inner

    for (let depth = $pos.depth - 1; depth >= 0; depth--) {
      let found = dir < 0
          ? findSelectionIn($pos.node(0), $pos.node(depth), $pos.before(depth + 1), $pos.index(depth), dir, textOnly)
          : findSelectionIn($pos.node(0), $pos.node(depth), $pos.after(depth + 1), $pos.index(depth) + 1, dir, textOnly)
      if (found) return found
    }
  }

  // :: (ResolvedPos, ?number, ?bool) → Selection
  // Find a valid cursor or leaf node selection near the given
  // position. Searches forward first by default, but if `bias` is
  // negative, it will search backwards first.
  static findNear($pos, bias = 1) {
    let result = this.findFrom($pos, bias) || this.findFrom($pos, -bias)
    if (!result) throw new RangeError("Searching for selection in invalid document " + $pos.node(0))
    return result
  }

  // :: (Node, ?bool) → ?Selection
  // Find the cursor or leaf node selection closest to the start of
  // the given document. When `textOnly` is true, only consider cursor
  // selections.
  static findAtStart(doc, textOnly) {
    return findSelectionIn(doc, doc, 0, 0, 1, textOnly)
  }

  // :: (Node, ?bool) → ?Selection
  // Find the cursor or leaf node selection closest to the end of
  // the given document. When `textOnly` is true, only consider cursor
  // selections.
  static findAtEnd(doc, textOnly) {
    return findSelectionIn(doc, doc, doc.content.size, doc.childCount, -1, textOnly)
  }
}
exports.Selection = Selection

// ;; A text selection represents a classical editor
// selection, with a head (the moving side) and anchor (immobile
// side), both of which point into textblock nodes. It can be empty (a
// regular cursor position).
class TextSelection extends Selection {
  // :: number
  // The selection's immobile side (does not move when pressing
  // shift-arrow).
  get anchor() { return this.$anchor.pos }
  // :: number
  // The selection's mobile side (the side that moves when pressing
  // shift-arrow).
  get head() { return this.$head.pos }

  // :: (ResolvedPos, ?ResolvedPos)
  // Construct a text selection. When `head` is not given, it defaults
  // to `anchor`.
  constructor($anchor, $head = $anchor) {
    let inv = $anchor.pos > $head.pos
    super(inv ? $head : $anchor, inv ? $anchor : $head)
    // :: ResolvedPos The resolved anchor of the selection.
    this.$anchor = $anchor
    // :: ResolvedPos The resolved head of the selection.
    this.$head = $head
  }

  get inverted() { return this.anchor > this.head }

  eq(other) {
    return other instanceof TextSelection && other.head == this.head && other.anchor == this.anchor
  }

  map(doc, mapping) {
    let $head = doc.resolve(mapping.map(this.head))
    if (!$head.parent.isTextblock) return Selection.findNear($head)
    let $anchor = doc.resolve(mapping.map(this.anchor))
    return new TextSelection($anchor.parent.isTextblock ? $anchor : $head, $head)
  }

  get token() {
    return new SelectionToken(TextSelection, this.anchor, this.head)
  }

  static mapToken(token, mapping) {
    return new SelectionToken(TextSelection, mapping.map(token.a), mapping.map(token.b))
  }

  static fromToken(token, doc) {
    let $head = doc.resolve(token.b)
    if (!$head.parent.isTextblock) return Selection.findNear($head)
    let $anchor = doc.resolve(token.a)
    return new TextSelection($anchor.parent.isTextblock ? $anchor : $head, $head)
  }
}
exports.TextSelection = TextSelection

// ;; A node selection is a selection that points at a
// single node. All nodes marked [selectable](#NodeType.selectable)
// can be the target of a node selection. In such an object, `from`
// and `to` point directly before and after the selected node.
class NodeSelection extends Selection {
  // :: (ResolvedPos)
  // Create a node selection. Does not verify the validity of its
  // argument. Use `ProseMirror.setNodeSelection` for an easier,
  // error-checking way to create a node selection.
  constructor($from) {
    let $to = $from.plusOne()
    super($from, $to)
    // :: Node The selected node.
    this.node = $from.nodeAfter
  }

  eq(other) {
    return other instanceof NodeSelection && this.from == other.from
  }

  map(doc, mapping) {
    let $from = doc.resolve(mapping.map(this.from, 1))
    let to = mapping.map(this.to, -1)
    let node = $from.nodeAfter
    if (node && to == $from.pos + node.nodeSize && node.type.selectable)
      return new NodeSelection($from)
    return Selection.findNear($from)
  }

  get token() {
    return new SelectionToken(NodeSelection, this.from, this.to)
  }

  static mapToken(token, mapping) {
    return new SelectionToken(NodeSelection, mapping.map(token.a, 1), mapping.map(token.b, -1))
  }

  static fromToken(token, doc) {
    let $from = doc.resolve(token.a), node = $from.nodeAfter
    if (node && token.b == token.a + node.nodeSize && node.type.selectable)
      return new NodeSelection($from)
    return Selection.findNear($from)
  }
}
exports.NodeSelection = NodeSelection

class SelectionToken {
  constructor(type, a, b) {
    this.type = type
    this.a = a
    this.b = b
  }
}

function isCollapsed(sel) {
  // Selection.isCollapsed is broken in Chrome 52.
  // See https://bugs.chromium.org/p/chromium/issues/detail?id=447523
  return sel.focusNode === sel.anchorNode && sel.focusOffset === sel.anchorOffset
}
exports.isCollapsed = isCollapsed

function selectionFromDOM(pm, oldHead) {
  let sel = pm.root.getSelection()
  const doc = pm.doc
  let {pos: head, inLeaf: headLeaf} = posFromDOM(sel.focusNode, sel.focusOffset)
  if (headLeaf > -1 && isCollapsed(sel)) {
    let $leaf = doc.resolve(headLeaf), node = $leaf.nodeAfter
    if (node.type.selectable && !node.type.isInline) return {range: new NodeSelection($leaf), adjusted: true}
  }
  let anchor = isCollapsed(sel) ? head : posFromDOM(sel.anchorNode, sel.anchorOffset).pos

  let range = Selection.findNear(doc.resolve(head), oldHead != null && oldHead < head ? 1 : -1)
  if (range instanceof TextSelection) {
    let selNearAnchor = Selection.findFrom(doc.resolve(anchor), anchor > range.to ? -1 : 1, true)
    range = new TextSelection(selNearAnchor.$anchor, range.$head)
  } else if (anchor < range.from || anchor > range.to) {
    // If head falls on a node, but anchor falls outside of it,
    // create a text selection between them
    let inv = anchor > range.to
    let foundAnchor = Selection.findFrom(doc.resolve(anchor), inv ? -1 : 1, true)
    let foundHead = Selection.findFrom(inv ? range.$from : range.$to, inv ? 1 : -1, true)
    if (foundAnchor && foundHead)
      range = new TextSelection(foundAnchor.$anchor, foundHead.$head)
  }
  return {range, adjusted: head != range.head || anchor != range.anchor}
}

function hasFocus(pm) {
  if (pm.root.activeElement != pm.content) return false
  let sel = pm.root.getSelection()
  return sel.rangeCount && contains(pm.content, sel.anchorNode)
}
exports.hasFocus = hasFocus

// Try to find a selection inside the given node. `pos` points at the
// position where the search starts. When `text` is true, only return
// text selections.
function findSelectionIn(doc, node, pos, index, dir, text) {
  if (node.isTextblock) return new TextSelection(doc.resolve(pos))
  for (let i = index - (dir > 0 ? 0 : 1); dir > 0 ? i < node.childCount : i >= 0; i += dir) {
    let child = node.child(i)
    if (!child.type.isLeaf) {
      let inner = findSelectionIn(doc, child, pos + dir, dir < 0 ? child.childCount : 0, dir, text)
      if (inner) return inner
    } else if (!text && child.type.selectable) {
      return new NodeSelection(doc.resolve(pos - (dir < 0 ? child.nodeSize : 0)))
    }
    pos += child.nodeSize * dir
  }
}

// FIXME we'll need some awareness of text direction when scanning for selections

// : (ProseMirror, number, number)
// Whether vertical position motion in a given direction
// from a position would leave a text block.
function verticalMotionLeavesTextblock(pm, $pos, dir) {
  let dom = $pos.depth ? DOMAfterPos(pm, $pos.before()) : pm.content
  let coords = coordsAtPos(pm, $pos.pos)
  for (let child = dom.firstChild; child; child = child.nextSibling) {
    if (child.nodeType != 1) continue
    let boxes = child.getClientRects()
    for (let i = 0; i < boxes.length; i++) {
      let box = boxes[i]
      if (dir < 0 ? box.bottom < coords.top : box.top > coords.bottom)
        return false
    }
  }
  return true
}
exports.verticalMotionLeavesTextblock = verticalMotionLeavesTextblock
