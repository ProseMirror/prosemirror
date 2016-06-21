const {Fragment} = require("../model")
const {Transform, insertPoint} = require("../transform")
const {Selection} = require("./selection")

const applyAndScroll = {scrollIntoView: true}

// ;; A selection-aware extension of `Transform`. Use
// `ProseMirror.tr` to create an instance.
class EditorTransform extends Transform {
  constructor(pm) {
    super(pm.doc)
    this.pm = pm
    this.curSelection = pm.selection
    this.curSelectionAt = 0
  }

  // :: (?Object) → EditorTransform
  // Apply the transformation. Returns the transform, or `false` it is
  // was empty.
  apply(options) {
    return this.pm.apply(this, options)
  }

  // :: () → EditorTransform
  // Apply this transform with a `{scrollIntoView: true}` option.
  applyAndScroll() {
    return this.pm.apply(this, applyAndScroll)
  }

  // :: Selection
  // The transform's current selection. This defaults to the
  // editor selection [mapped](#Selection.map) through the steps in
  // this transform, but can be overwritten with
  // [`setSelection`](#EditorTransform.setSelection).
  get selection() {
    if (this.curSelectionAt < this.steps.length) {
      if (this.curSelectionAt) {
        for (let i = this.curSelectionAt; i < this.steps.length; i++)
          this.curSelection = this.curSelection.map(i == this.steps.length - 1 ? this.doc : this.docs[i + 1], this.maps[i])
      } else {
        this.curSelection = this.curSelection.map(this.doc, this)
      }
      this.curSelectionAt = this.steps.length
    }
    return this.curSelection
  }

  // :: (Selection) → EditorTransform
  // Update the transform's current selection. This will determine the
  // selection that the editor gets when the transform is applied.
  setSelection(selection) {
    this.curSelection = selection
    this.curSelectionAt = this.steps.length
    return this
  }

  // :: (?Node, ?bool) → EditorTransform
  // Replace the selection with the given node, or delete it if `node`
  // is null. When `inheritMarks` is true and the node is an inline
  // node, it inherits the marks from the place where it is inserted.
  replaceSelection(node, inheritMarks) {
    let {empty, $from, $to, from, to, node: selNode} = this.selection

    if (node && node.isInline && inheritMarks !== false)
      node = node.mark(empty ? this.pm.input.storedMarks : this.doc.marksAt(from))
    let fragment = Fragment.from(node)

    if (selNode && selNode.isTextblock && node && node.isInline) {
      // Putting inline stuff onto a selected textblock puts it
      // inside, so cut off the sides
      from++
      to--
    } else if (selNode) {
      let depth = $from.depth
      // This node can not simply be removed/replaced. Remove its parent as well
      while (depth && $from.node(depth).childCount == 1 &&
             !$from.node(depth).canReplace($from.index(depth), $to.indexAfter(depth), fragment)) {
        depth--
      }
      if (depth < $from.depth) {
        from = $from.before(depth + 1)
        to = $from.after(depth + 1)
      }
    } else if (node && from == to) {
      let point = insertPoint(this.doc, from, node.type, node.attrs)
      if (point != null) from = to = point
    }

    this.replaceWith(from, to, fragment)
    let map = this.maps[this.maps.length - 1]
    this.setSelection(Selection.findNear(this.doc.resolve(map.map(to))))
    return this
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
exports.EditorTransform = EditorTransform
