const {Plugin} = require("../edit")
const {elt, insertCSS} = require("../util/dom")

const {renderGrouped} = require("./menu")

const prefix = "ProseMirror-menubar"

class MenuBar {
  constructor(pm, config) {
    this.pm = pm

    this.wrapper = pm.wrapper.insertBefore(elt("div", {class: prefix}), pm.wrapper.firstChild)
    this.spacer = null
    this.maxHeight = 0
    this.widthForMaxHeight = 0

    this.updater = pm.updateScheduler([
      pm.on.selectionChange,
      pm.on.change,
      pm.on.activeMarkChange
    ], () => this.update())
    this.content = config.content
    this.updater.force()

    this.floating = false
    if (config.float) {
      this.updateFloat()
      this.scrollFunc = () => {
        if (!document.body.contains(this.pm.wrapper))
          window.removeEventListener("scroll", this.scrollFunc)
        else
          this.updateFloat()
      }
      window.addEventListener("scroll", this.scrollFunc)
    }
  }

  detach() {
    this.updater.detach()
    this.wrapper.parentNode.removeChild(this.wrapper)
    if (this.spacer) this.spacer.parentNode.removeChild(this.spacer)

    if (this.scrollFunc)
      window.removeEventListener("scroll", this.scrollFunc)
  }

  update() {
    this.wrapper.textContent = ""
    this.wrapper.appendChild(renderGrouped(this.pm, this.content))

    return this.floating ? this.updateScrollCursor() : () => {
      if (this.wrapper.offsetWidth != this.widthForMaxHeight) {
        this.widthForMaxHeight = this.wrapper.offsetWidth
        this.maxHeight = 0
      }
      if (this.wrapper.offsetHeight > this.maxHeight) {
        this.maxHeight = this.wrapper.offsetHeight
        return () => { this.wrapper.style.minHeight = this.maxHeight + "px" }
      }
    }
  }

  updateFloat() {
    let editorRect = this.pm.wrapper.getBoundingClientRect()
    if (this.floating) {
      if (editorRect.top >= 0 || editorRect.bottom < this.wrapper.offsetHeight + 10) {
        this.floating = false
        this.wrapper.style.position = this.wrapper.style.left = this.wrapper.style.width = ""
        this.wrapper.style.display = ""
        this.spacer.parentNode.removeChild(this.spacer)
        this.spacer = null
      } else {
        let border = (this.pm.wrapper.offsetWidth - this.pm.wrapper.clientWidth) / 2
        this.wrapper.style.left = (editorRect.left + border) + "px"
        this.wrapper.style.display = (editorRect.top > window.innerHeight ? "none" : "")
      }
    } else {
      if (editorRect.top < 0 && editorRect.bottom >= this.wrapper.offsetHeight + 10) {
        this.floating = true
        let menuRect = this.wrapper.getBoundingClientRect()
        this.wrapper.style.left = menuRect.left + "px"
        this.wrapper.style.width = menuRect.width + "px"
        this.wrapper.style.position = "fixed"
        this.spacer = elt("div", {class: prefix + "-spacer", style: "height: " + menuRect.height + "px"})
        this.pm.wrapper.insertBefore(this.spacer, this.wrapper)
      }
    }
  }

  updateScrollCursor() {
    if (!this.floating) return null
    let head = this.pm.selection.head
    if (!head) return null
    return () => {
      let cursorPos = this.pm.coordsAtPos(head)
      let menuRect = this.wrapper.getBoundingClientRect()
      if (cursorPos.top < menuRect.bottom && cursorPos.bottom > menuRect.top) {
        let scrollable = findWrappingScrollable(this.pm.wrapper)
        if (scrollable)
          return () => { scrollable.scrollTop -= (menuRect.bottom - cursorPos.top) }
      }
    }
  }
}

function findWrappingScrollable(node) {
  for (let cur = node.parentNode; cur; cur = cur.parentNode)
    if (cur.scrollHeight > cur.clientHeight) return cur
}

// :: Plugin
// Plugin that enables the menu bar for an editor. The menu bar takes
// up space above the editor, showing currently available commands
// (that have been [added](#CommandSpec.menuGroup) to the menu). The
// following options are supported:
//
// **`float`**`: bool = false`
//   : When enabled, causes the menu bar to stay visible when the
//     editor is partially scrolled out of view, by making it float at
//     the top of the viewport.
//
// **`content`**`: [`[`MenuGroup`](#MenuGroup)`]`
//   : Determines the content of the menu.
const menuBar = new Plugin(MenuBar, {
  content: [],
  float: false
})
exports.menuBar = menuBar

insertCSS(`
.${prefix} {
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
  position: relative;
  min-height: 1em;
  color: #666;
  padding: 1px 6px;
  top: 0; left: 0; right: 0;
  border-bottom: 1px solid silver;
  background: white;
  z-index: 10;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  overflow: visible;
}
`)
