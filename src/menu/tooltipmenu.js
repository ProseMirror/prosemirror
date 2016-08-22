const {Plugin} = require("../edit")
const {elt, insertCSS} = require("../util/dom")
const {Tooltip} = require("../tooltip")

const {renderGrouped} = require("./menu")

const classPrefix = "ProseMirror-tooltipmenu"

class TooltipMenu {
  constructor(pm, config) {
    this.pm = pm
    this.config = config

    this.selectedBlockMenu = this.config.selectedBlockMenu
    this.updater = pm.updateScheduler([
      pm.on.change,
      pm.on.selectionChange,
      pm.on.blur,
      pm.on.focus
    ], () => this.update())
    this.onContextMenu = this.onContextMenu.bind(this)
    pm.content.addEventListener("contextmenu", this.onContextMenu)

    this.tooltip = new Tooltip(pm.wrapper, this.config.position)
    this.selectedBlockContent = this.config.selectedBlockContent || this.config.inlineContent.concat(this.config.blockContent)
  }

  detach() {
    this.updater.detach()
    this.tooltip.detach()
    this.pm.content.removeEventListener("contextmenu", this.onContextMenu)
  }

  show(content, coords) {
    let rendered = renderGrouped(this.pm, content)
    if (rendered.childNodes.length)
      this.tooltip.open(elt("div", null, rendered), coords)
    else
      this.tooltip.close()
  }

  update() {
    let {empty, node, $from, to} = this.pm.selection, link
    if (!this.pm.hasFocus()) {
      this.tooltip.close()
    } else if (node && node.isBlock) {
      return () => {
        let coords = this.nodeSelectionCoords()
        return () => this.show(this.config.blockContent, coords)
      }
    } else if (!empty) {
      return () => {
        let coords = node ? this.nodeSelectionCoords() : this.selectionCoords()
        let showBlock = this.selectedBlockMenu && $from.parentOffset == 0 && $from.end() == to
        return () => this.show(showBlock ? this.selectedBlockContent : this.config.inlineContent, coords)
      }
    } else if (this.selectedBlockMenu && $from.parent.content.size == 0) {
      return () => {
        let coords = this.selectionCoords()
        return () => this.show(this.config.blockContent, coords)
      }
    } else if (this.config.showLinks && (link = this.linkUnderCursor())) {
      return () => {
        let coords = this.selectionCoords()
        return () => this.showLink(link, coords)
      }
    } else {
      this.tooltip.close()
    }
  }

  selectionCoords() {
    let pos = this.config.position == "above" ? topCenterOfSelection(this.pm.root) : bottomCenterOfSelection(this.pm.root)
    if (pos.top != 0) return pos
    let realPos = this.pm.coordsAtPos(this.pm.selection.from)
    return {left: realPos.left, top: this.config.position == "above" ? realPos.top : realPos.bottom}
  }

  nodeSelectionCoords() {
    let selected = this.pm.content.querySelector(".ProseMirror-selectednode")
    if (!selected) return {left: 0, top: 0}
    let box = selected.getBoundingClientRect()
    return {left: Math.min((box.left + box.right) / 2, box.left + 20),
            top: this.config.position == "above" ? box.top : box.bottom}
  }

  linkUnderCursor() {
    let head = this.pm.selection.head
    if (!head) return null
    let marks = this.pm.doc.marksAt(head)
    return marks.reduce((found, m) => found || (m.type.name == "link" && m), null)
  }

  showLink(link, pos) {
    let node = elt("div", {class: classPrefix + "-linktext"},
                   elt("a",
                       {href: link.attrs.href,
                        title: link.attrs.title,
                        rel: "noreferrer noopener",
                        target: "_blank"},
                      link.attrs.href))
    this.tooltip.open(node, pos)
  }

  onContextMenu(e) {
    if (!this.pm.selection.empty) return
    let pos = this.pm.posAtCoords({left: e.clientX, top: e.clientY})
    if (!pos || !this.pm.doc.resolve(pos).parent.isTextblock) return

    this.pm.setTextSelection(pos, pos)
    this.pm.flush()
    this.show(this.config.inlineContent, this.selectionCoords())
  }
}

// Get the x and y coordinates at the top center of the current DOM selection.
function topCenterOfSelection(root) {
  let range = root.getSelection().getRangeAt(0), rects = range.getClientRects()
  if (!rects.length) return range.getBoundingClientRect()
  let left, right, top, bottom
  for (let i = 0; i < rects.length; i++) {
    let rect = rects[i]
    if (left == right) {
      ;({left, right, top, bottom} = rect)
    } else if (rect.top < bottom - 1 &&
               // Chrome bug where bogus rectangles are inserted at span boundaries
               (i == rects.length - 1 || Math.abs(rects[i + 1].left - rect.left) > 1)) {
      left = Math.min(left, rect.left)
      right = Math.max(right, rect.right)
      top = Math.min(top, rect.top)
    }
  }
  return {top, left: (left + right) / 2}
}

function bottomCenterOfSelection(root) {
  let range = root.getSelection().getRangeAt(0), rects = range.getClientRects()
  if (!rects.length) {
    let rect = range.getBoundingClientRect()
    return {left: rect.left, top: rect.bottom}
  }

  let left, right, bottom, top
  for (let i = rects.length - 1; i >= 0; i--) {
    let rect = rects[i]
    if (left == right) {
      ;({left, right, bottom, top} = rect)
    } else if (rect.bottom > top + 1 &&
               (i == 0 || Math.abs(rects[i - 1].left - rect.left) > 1)) {
      left = Math.min(left, rect.left)
      right = Math.max(right, rect.right)
      bottom = Math.min(bottom, rect.bottom)
    }
  }
  return {top: bottom, left: (left + right) / 2}
}

// :: Plugin
// Enables the tooltip menu for this editor. This menu shows up when
// there is a selection, and optionally in certain other
// circumstances, providing context-relevant commands.
//
// By default, the tooltip will show inline menu commands (registered
// with the [`menuGroup`](#CommandSpec.menuGroup) command property)
// when there is an inline selection, and block related commands when
// there is a node selection on a block.
//
// The plugin supports the following options:
//
// **`showLinks`**`: bool = true`
//   : Causes a tooltip with the link target to show up when the
//     cursor is inside of a link (without a selection).
//
// **`selectedBlockMenu`**`: bool = false`
//   : When enabled, and a whole block is selected or the cursor is
//     inside an empty block, the block menu gets shown.
//
// **`inlineContent`**`: [`[`MenuGroup`](#MenuGroup)`]`
//   : The menu elements to show when displaying the menu for inline
//     content.
//
// **`blockContent`**`: [`[`MenuGroup`](#MenuGroup)`]`
//   : The menu elements to show when displaying the menu for block
//     content.
//
// **`selectedBlockContent`**`: [MenuGroup]`
//   : The elements to show when a full block has been selected and
//     `selectedBlockMenu` is enabled. Defaults to concatenating
//     `inlineContent` and `blockContent`.
//
// **`position`**`: string`
//  : Where, relative to the selection, the tooltip should appear.
//    Defaults to `"above"`. Can also be set to `"below"`.
const tooltipMenu = new Plugin(TooltipMenu, {
  showLinks: true,
  selectedBlockMenu: false,
  inlineContent: [],
  blockContent: [],
  selectedBlockContent: null,
  position: "above"
})
exports.tooltipMenu = tooltipMenu

insertCSS(`

.${classPrefix}-linktext a {
  color: #444;
  text-decoration: none;
  padding: 0 5px;
}

.${classPrefix}-linktext a:hover {
  text-decoration: underline;
}

`)
