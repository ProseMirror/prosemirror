import {Fragment} from "../model"
import {Transform} from "../transform"

// ;; A selection-aware extension of `Transform`. Use
// `ProseMirror.tr` to create an instance.
export class EditorTransform extends Transform {
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
    let {empty, from, to, node: selNode} = this.selection

    if (node && node.isInline && inheritMarks !== false)
      node = node.mark(empty ? this.pm.input.storedMarks : this.doc.marksAt(from))

    if (selNode && selNode.isTextblock && node && node.isInline) {
      // Putting inline stuff onto a selected textblock puts it
      // inside, so cut off the sides
      from++
      to--
    } else if (selNode) {
      // This node can not simply be removed/replaced. Remove its parent as well
      let $from = this.doc.resolve(from), depth = $from.depth
      while (depth && $from.node(depth).childCount == 1 &&
             !$from.node(depth).canReplace($from.index(depth - 1), $from.index(depth - 1) + 1, Fragment.from(node)))
        depth--
      if (depth < $from.depth) {
        from = $from.before(depth + 1)
        to = $from.after(depth + 1)
      }
    } else if (node && from == to) {
      let $from = this.doc.resolve(from)
      if ($from.parentOffset == 0) {
        for (let d = $from.depth; d > 0; d--) {
          if ((d == $from.depth || $from.index(d) == 0) &&
              !$from.node(d).canReplace($from.index(d), $from.index(d), Fragment.from(node))) from = to = $from.before(d)
          else break
        }
      } else if ($from.parentOffset == $from.parent.content.size) {
        for (let d = $from.depth; d > 0; d--) {
          if ((d == $from.depth || $from.index(d) == $from.node(d).childCount - 1) &&
              !$from.node(d).canReplace($from.index(d) + 1, $from.index(d) + 1, Fragment.from(node))) from = to = $from.after(d)
          else break
        }
      }
    }

    return this.replaceWith(from, to, node)
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
