import {elt, insertCSS} from "../dom"

const prefix = "ProseMirror-tooltip"

// ;; Used to show tooltips. An instance of this class is a persistent
// DOM node (to allow position and opacity animation) that can be
// shown and hidden. It is positioned relative to a position (passed
// when showing the tooltip), and points at that position with a
// little arrow-like triangle attached to the node.
export class Tooltip {
  // :: (DOMNode, string)
  // Create a new tooltip that lives in the wrapper node, which should
  // be its offset anchor, i.e. it should have a `relative` or
  // `absolute` CSS position. You'll often want to pass an editor's
  // [`wrapper` node](#ProseMirror.wrapper). `dir` may be `"above"`,
  // `"below"`, `"right"`, `"left"`, or `"center"`. In the latter
  // case, the tooltip has no arrow and is positioned centered in its
  // wrapper node.
  constructor(wrapper, dir) {
    this.wrapper = wrapper
    this.dir = dir || "above"
    this.pointer = wrapper.appendChild(elt("div", {class: prefix + "-pointer-" + this.dir + " " + prefix + "-pointer"}))
    this.pointerWidth = this.pointerHeight = null
    this.dom = wrapper.appendChild(elt("div", {class: prefix}))
    this.dom.addEventListener("transitionend", () => {
      if (this.dom.style.opacity == "0")
        this.dom.style.display = this.pointer.style.display = ""
    })

    this.isOpen = false
    this.lastLeft = this.lastRight = null
  }

  // :: ()
  // Remove the tooltip from the DOM.
  detach() {
    this.dom.parentNode.removeChild(this.dom)
    this.pointer.parentNode.removeChild(this.pointer)
  }

  getSize(node) {
    let wrap = this.wrapper.appendChild(elt("div", {
      class: prefix,
      style: "display: block; position: absolute"
    }, node))
    let size = {width: wrap.offsetWidth, height: wrap.offsetHeight}
    wrap.parentNode.removeChild(wrap)
    return size
  }

  // :: (DOMNode, ?{left: number, top: number})
  // Make the tooltip visible, show the given node in it, and position
  // it relative to the given position. If `pos` is not given, the
  // tooltip stays in its previous place. Unless the tooltip's
  // direction is `"center"`, `pos` should definitely be given the
  // first time it is shown.
  open(node, pos) {
    let left = this.lastLeft = pos ? pos.left : this.lastLeft
    let top = this.lastTop = pos ? pos.top : this.lastTop

    let size = this.getSize(node)

    let around = this.wrapper.getBoundingClientRect()

    for (let child = this.dom.firstChild, next; child; child = next) {
      next = child.nextSibling
      if (child != this.pointer) this.dom.removeChild(child)
    }
    this.dom.appendChild(node)

    this.dom.style.display = this.pointer.style.display = "block"

    if (this.pointerWidth == null) {
      this.pointerWidth = this.pointer.offsetWidth - 1
      this.pointerHeight = this.pointer.offsetHeight - 1
    }

    this.dom.style.width = size.width + "px"
    this.dom.style.height = size.height + "px"

    const margin = 5
    if (this.dir == "above" || this.dir == "below") {
      let tipLeft = Math.max(0, Math.min(left - size.width / 2, window.innerWidth - size.width))
      this.dom.style.left = (tipLeft - around.left) + "px"
      this.pointer.style.left = (left - around.left - this.pointerWidth / 2) + "px"
      if (this.dir == "above") {
        let tipTop = top - around.top - margin - this.pointerHeight - size.height
        this.dom.style.top = tipTop + "px"
        this.pointer.style.top = (tipTop + size.height) + "px"
      } else { // below
        let tipTop = top - around.top + margin
        this.pointer.style.top = tipTop + "px"
        this.dom.style.top = (tipTop + this.pointerHeight) + "px"
      }
    } else if (this.dir == "left" || this.dir == "right") {
      this.dom.style.top = (top - around.top - size.height / 2) + "px"
      this.pointer.style.top = (top - this.pointerHeight / 2 - around.top) + "px"
      if (this.dir == "left") {
        let pointerLeft = left - around.left - margin - this.pointerWidth
        this.dom.style.left = (pointerLeft - size.width) + "px"
        this.pointer.style.left = pointerLeft + "px"
      } else { // right
        let pointerLeft = left - around.left + margin
        this.dom.style.left = (pointerLeft + this.pointerWidth) + "px"
        this.pointer.style.left = pointerLeft + "px"
      }
    } else if (this.dir == "center") {
      let top = Math.max(around.top, 0), bottom = Math.min(around.bottom, window.innerHeight)
      let fromTop = (bottom - top - size.height) / 2
      this.dom.style.left = (around.width - size.width) / 2 + "px"
      this.dom.style.top = (top - around.top + fromTop) + "px"
    }

    getComputedStyle(this.dom).opacity
    getComputedStyle(this.pointer).opacity
    this.dom.style.opacity = this.pointer.style.opacity = 1
    this.isOpen = true
  }

  // :: ()
  // Close (hide) the tooltip.
  close() {
    if (this.isOpen) {
      this.isOpen = false
      this.dom.style.opacity = this.pointer.style.opacity = 0
    }
  }
}

insertCSS(`

.${prefix} {
  position: absolute;
  display: none;
  box-sizing: border-box;
  -moz-box-sizing: border- box;
  overflow: hidden;

  -webkit-transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  -moz-transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  opacity: 0;

  border-radius: 5px;
  padding: 3px 7px;
  margin: 0;
  background: #444;
  border-color: #777;
  color: white;

  z-index: 11;
}

.${prefix}-pointer {
  content: "";
  position: absolute;
  display: none;
  width: 0; height: 0;

  -webkit-transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  -moz-transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  opacity: 0;

  z-index: 12;
}

.${prefix}-pointer-above {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #444;
}

.${prefix}-pointer-below {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid #444;
}

.${prefix}-pointer-right {
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid #444;
}

.${prefix}-pointer-left {
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 6px solid #444;
}

.${prefix} input[type="text"],
.${prefix} textarea {
  background: #666;
  color: white;
  border: none;
  outline: none;
}

.${prefix} input[type="text"] {
  padding: 0 4px;
}

`)
