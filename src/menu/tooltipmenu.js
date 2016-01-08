import {Pos} from "../model"
import {defineOption} from "../edit"
import {elt, insertCSS} from "../dom"
import {Tooltip} from "../ui/tooltip"
import {UpdateScheduler} from "../ui/update"

import {Menu, TooltipDisplay, menuGroups} from "./menu"

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
// **`inlineGroups`**`: [string] = ["inline"]`
//   : The menu groups to show when displaying the menu for inline
//     content.
//
// **`inlineItems`**`: [union<string, [string]>]`
//   : Instead of using menu groups, this can be used to completely
//     override the set of commands shown for inline content. If
//     nested arrays are used, separators will be shown between items
//     from different arrays.
//
// **`blockGroups`**`: [string] = ["block"]`
//   : The menu groups to show when displaying the menu for block
//     content.
//
// **`blockItems`**`: [union<string, [string]>]`
//   : Overrides the commands shown for block content.

defineOption("tooltipMenu", false, function(pm, value) {
  if (pm.mod.tooltipMenu) pm.mod.tooltipMenu.detach()
  pm.mod.tooltipMenu = value ? new TooltipMenu(pm, value) : null
})

function getItems(pm, items) {
  return Array.isArray(items) ? items.map(getItems.bind(null, pm)) : pm.commands[items]
}

class TooltipMenu {
  constructor(pm, config) {
    this.pm = pm
    this.config = config || {}

    this.showLinks = this.config.showLinks !== false
    this.selectedBlockMenu = this.config.selectedBlockMenu
    this.update = new UpdateScheduler(pm, "change selectionChange blur commandsChanged", () => this.prepareUpdate())

    this.tooltip = new Tooltip(pm.wrapper, "above")
    this.menu = new Menu(pm, new TooltipDisplay(this.tooltip), () => this.update.force())
  }

  detach() {
    this.update.detach()
    this.tooltip.detach()
  }

  items(inline, block) {
    let items
    if (!inline) items = []
    else if (this.config.inlineItems) items = getItems(this.pm, this.config.inlineItems)
    else items = menuGroups(this.pm, this.config.inlineGroups || ["inline"])

    if (block) {
      if (this.config.blockItems) items = items.concat(getItems(this.pm, this.config.blockItems))
      else items = items.concat(menuGroups(this.pm, this.config.blockGroups || ["block"]))
    }
    return items
  }

  prepareUpdate() {
    if (this.menu.active) return null

    let {empty, node, from, to} = this.pm.selection, link
    if (!this.pm.hasFocus()) {
      return () => this.tooltip.close()
    } else if (node && node.isBlock) {
      let coords = topOfNodeSelection(this.pm)
      return () => this.menu.show(this.items(false, true), coords)
    } else if (!empty) {
      let coords = node ? topOfNodeSelection(this.pm) : topCenterOfSelection()
      let showBlock = this.selectedBlockMenu && Pos.samePath(from.path, to.path) &&
          from.offset == 0 && to.offset == this.pm.doc.path(from.path).size
      return () => this.menu.show(this.items(true, showBlock), coords)
    } else if (this.selectedBlockMenu && this.pm.doc.path(from.path).size == 0) {
      let coords = this.pm.coordsAtPos(from)
      return () => this.menu.show(this.items(false, true), coords)
    } else if (this.showLinks && (link = this.linkUnderCursor())) {
      let coords = this.pm.coordsAtPos(from)
      return () => this.showLink(link, coords)
    } else {
      return () => this.tooltip.close()
    }
  }

  linkUnderCursor() {
    let head = this.pm.selection.head
    if (!head) return null
    let marks = this.pm.doc.marksAt(head)
    return marks.reduce((found, m) => found || (m.type.name == "link" && m), null)
  }

  showLink(link, pos) {
    let node = elt("div", {class: classPrefix + "-linktext"}, elt("a", {href: link.attrs.href, title: link.attrs.title}, link.attrs.href))
    this.tooltip.open(node, pos)
  }
}

// Get the x and y coordinates at the top center of the current DOM selection.
function topCenterOfSelection() {
  let rects = window.getSelection().getRangeAt(0).getClientRects()
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
