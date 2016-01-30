import {Pos} from "../model"
import {defineOption} from "../edit"
import {elt, insertCSS} from "../dom"
import {Tooltip} from "../ui/tooltip"
import {UpdateScheduler} from "../ui/update"

import {separator} from "./menu" // FIXME
import {GroupedMenu} from "./menu"
import {inlineGroup, insertMenu, textblockMenu, blockGroup} from "./defaultmenu"

const classPrefix = "ProseMirror-tooltipmenu"

// :: union<bool, Object> #path=tooltipMenu #kind=option
//
// When given a truthy value, enables the tooltip menu module for this
// editor. This menu shows up when there is a selection, and
// optionally in certain other circumstances, providing
// context-relevant commands.
//
// By default, the tooltip will show inline menu commands (registered
// with the [`menuGroup`](#CommandSpec.menuGroup) command property)
// when there is an inline selection, and block related commands when
// there is a node selection on a block.
//
// The module can be configured by passing an object. These properties
// are recognized:
//
// **`showLinks`**`: bool = true`
//   : Causes a tooltip with the link target to show up when the
//     cursor is inside of a link (without a selection).
//
// **`selectedBlockMenu`**: bool = false`
//   : When enabled, and a whole block is selected or the cursor is
//     inside an empty block, the block menu gets shown.
//
// **`inlineGroups`**`: [string] = ["inline", "insert"]`
//   : The menu groups to show when displaying the menu for inline
//     content.
//
// **`inlineItems`**`: [union<string, [string]>]`
//   : Instead of using menu groups, this can be used to completely
//     override the set of commands shown for inline content. If
//     nested arrays are used, separators will be shown between items
//     from different arrays.
//
// **`blockGroups`**`: [string] = ["insert", "block"]`
//   : The menu groups to show when displaying the menu for block
//     content.
//
// **`blockItems`**`: [union<string, [string]>]`
//   : Overrides the commands shown for block content.

defineOption("tooltipMenu", false, function(pm, value) {
  if (pm.mod.tooltipMenu) pm.mod.tooltipMenu.detach()
  pm.mod.tooltipMenu = value ? new TooltipMenu(pm, value) : null
})

const defaultInline = new GroupedMenu([inlineGroup, insertMenu])
const defaultBlock = new GroupedMenu([[textblockMenu, blockGroup]])

class TooltipMenu {
  constructor(pm, config) {
    this.pm = pm
    this.config = config || {}

    this.showLinks = this.config.showLinks !== false
    this.selectedBlockMenu = this.config.selectedBlockMenu
    this.updater = new UpdateScheduler(pm, "change selectionChange blur commandsChanged", () => this.update())
    this.onContextMenu = this.onContextMenu.bind(this)
    pm.content.addEventListener("contextmenu", this.onContextMenu)

    this.tooltip = new Tooltip(pm.wrapper, "above")
    this.inlineContent = this.config.inlineContent || defaultInline
    this.blockContent = this.config.blockContent || defaultBlock
  }

  detach() {
    this.updater.detach()
    this.tooltip.detach()
    this.pm.content.removeEventListener("contextmenu", this.onContextMenu)
  }

  show(inline, block, coords) {
    let inlineDOM = inline && this.inlineContent.render(this.pm)
    let blockDOM = block && this.blockContent.render(this.pm)
    let content = inline && block
        ? elt("div", null, inlineDOM, separator(), blockDOM)
        : elt("div", null, inlineDOM || blockDOM)
    this.tooltip.open(content, coords)
  }

  update() {
    let {empty, node, from, to} = this.pm.selection, link
    if (!this.pm.hasFocus()) {
      this.tooltip.close()
    } else if (node && node.isBlock) {
      return () => {
        let coords = topOfNodeSelection(this.pm)
        return () => this.show(false, true, coords)
      }
    } else if (!empty) {
      return () => {
        let coords = node ? topOfNodeSelection(this.pm) : topCenterOfSelection()
        let showBlock = this.selectedBlockMenu && Pos.samePath(from.path, to.path) &&
            from.offset == 0 && to.offset == this.pm.doc.path(from.path).size
        return () => this.show(true, showBlock, coords)
      }
    } else if (this.selectedBlockMenu && this.pm.doc.path(from.path).size == 0) {
      return () => {
        let coords = this.pm.coordsAtPos(from)
        return () => this.show(false, true, coords)
      }
    } else if (this.showLinks && (link = this.linkUnderCursor())) {
      return () => {
        let coords = this.pm.coordsAtPos(from)
        return () => this.showLink(link, coords)
      }
    } else {
      this.tooltip.close()
    }
  }

  linkUnderCursor() {
    let head = this.pm.selection.head
    if (!head) return null
    let marks = this.pm.doc.marksAt(head)
    return marks.reduce((found, m) => found || (m.type.name == "link" && m), null)
  }

  showLink(link, pos) {
    let node = elt("div", {class: classPrefix + "-linktext"},
                   elt("a", {href: link.attrs.href, title: link.attrs.title}, link.attrs.href))
    this.tooltip.open(node, pos)
  }

  onContextMenu(e) {
    if (!this.pm.selection.empty) return
    let pos = this.pm.posAtCoords({left: e.clientX, top: e.clientY})
    if (!pos || !pos.isValid(this.pm.doc, true)) return

    this.pm.setTextSelection(pos, pos)
    this.pm.flush()
    this.show(true, false, topCenterOfSelection())
  }
}

// Get the x and y coordinates at the top center of the current DOM selection.
function topCenterOfSelection() {
  let range = window.getSelection().getRangeAt(0), rects = range.getClientRects()
  if (!rects.length) return range.getBoundingClientRect()
  let {left, right, top} = rects[0], i = 1
  while (left == right && rects.length > i) {
    ;({left, right, top} = rects[i++])
  }
  for (; i < rects.length; i++) {
    if (rects[i].top < rects[0].bottom - 1 &&
        // Chrome bug where bogus rectangles are inserted at span boundaries
        (i == rects.length - 1 || Math.abs(rects[i + 1].left - rects[i].left) > 1)) {
      left = Math.min(left, rects[i].left)
      right = Math.max(right, rects[i].right)
      top = Math.min(top, rects[i].top)
    }
  }
  return {top, left: (left + right) / 2}
}

function topOfNodeSelection(pm) {
  let selected = pm.content.querySelector(".ProseMirror-selectednode")
  if (!selected) return {left: 0, top: 0}
  let box = selected.getBoundingClientRect()
  return {left: Math.min((box.left + box.right) / 2, box.left + 20), top: box.top}
}

insertCSS(`

.${classPrefix}-linktext a {
  color: white;
  text-decoration: none;
  padding: 0 5px;
}

.${classPrefix}-linktext a:hover {
  text-decoration: underline;
}

`)
