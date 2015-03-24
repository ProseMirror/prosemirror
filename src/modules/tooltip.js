import {elt} from "../edit/dom"
import "./tooltip.css"

const prefix = "ProseMirror-tooltip"

export class Tooltip {
  constructor(pm, dir) {
    this.pm = pm
    this.dir = dir || "above"
    this.knownSizes = Object.create(null)
    this.pointer = pm.wrapper.appendChild(elt("div", {class: prefix + "-pointer-" + this.dir + " " + prefix + "-pointer"}))
    this.pointerWidth = this.pointerHeight = null
    this.dom = pm.wrapper.appendChild(elt("div", {class: prefix}))
    // Prevent clicks on the tooltip from clearing editor selection
    this.dom.addEventListener("mousedown", e => { if (!this.active) e.preventDefault() })
    this.active = false
    this.lastLeft = this.lastRight = null

    pm.on("change", this.updateFunc = () => { if (!this.active) this.close() })
    pm.on("resize", this.updateFunc)
    pm.wrapper.addEventListener("mousedown", this.mouseFunc = e => {
      if (this.active && !this.dom.contains(e.target) && pm.wrapper.contains(e.target))
        this.close()
    })
  }

  detach() {
    this.dom.parentNode.removeChild(this.dom)
    this.pointer.parentNode.removeChild(this.pointer)
    pm.off("change", this.updateFunc)
    pm.off("resize", this.updateFunc)
    pm.wrapper.removeEventListener("mousedown", this.mouseFunc)
  }

  getSize(type, node) {
    let known = this.knownSizes[type]
    if (!known) {
      let wrap = this.pm.wrapper.appendChild(elt("div", {class: prefix}, node))
      wrap.style.display = "block"
      known = this.knownSizes[type] = {width: wrap.offsetWidth, height: wrap.offsetHeight}
      wrap.parentNode.removeChild(wrap)
    }
    return known
  }

  show(type, node, left, top) {
    if (this.pm.mod.tooltip && this.pm.mod.tooltip != this)
      this.pm.mod.tooltip.close()
    this.pm.mod.tooltip = this

    if (left == null) left = this.lastLeft
    else this.lastLeft = left
    if (top == null) top = this.lastTop
    else this.lastTop = top

    let size = this.getSize(type, node)

    let around = this.pm.wrapper.getBoundingClientRect()

    for (let child = this.dom.firstChild, next; child; child = next) {
      next = child.nextSibling
      if (child != this.pointer) this.dom.removeChild(child)
    }
    this.dom.appendChild(node)

    this.dom.style.display = this.pointer.style.display = "block"

    if (this.pointerWidth == null) {
      this.pointerWidth = this.pointer.offsetWidth
      this.pointerHeight = this.pointer.offsetHeight
    }

    this.dom.style.width = size.width + "px"
    this.dom.style.height = size.height + "px"

    const margin = 5
    if (this.dir == "above") {
      let tipLeft = Math.max(0, Math.min(left - size.width / 2, window.innerWidth - size.width))
      this.dom.style.left = (tipLeft - around.left) + "px"
      // FIXME do something if top < 0
      let tipTop = top - around.top - margin - this.pointerHeight - size.height
      this.dom.style.top = tipTop + "px"
      this.pointer.style.top = (tipTop + size.height) + "px"
      this.pointer.style.left = (left - around.left - this.pointerWidth / 2) + "px"
    } else { // right
      let pointerLeft = left - around.left + margin
      this.dom.style.left = (pointerLeft + this.pointerWidth) + "px"
      this.dom.style.top = (top - around.top - size.height / 2) + "px"
      this.pointer.style.left = pointerLeft + "px"
      this.pointer.style.top = (top - this.pointerHeight / 2 - around.top) + "px"
    }
  }

  close() {
    this.dom.style.display = this.pointer.style.display = ""
    this.active = false
    if (this.pm.mod.tooltip == this) this.pm.mod.tooltip = null
  }
}
