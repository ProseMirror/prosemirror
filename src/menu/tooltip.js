import {elt} from "../edit/dom"
import "./tooltip_css"

const prefix = "ProseMirror-tooltip"

export class Tooltip {
  constructor(pm, dir) {
    this.pm = pm
    this.dir = dir || "above"
    this.knownSizes = Object.create(null)
    this.pointer = pm.wrapper.appendChild(elt("div", {class: prefix + "-pointer-" + this.dir + " " + prefix + "-pointer"}))
    this.pointerWidth = this.pointerHeight = null
    this.dom = pm.wrapper.appendChild(elt("div", {class: prefix}))
    this.dom.addEventListener("transitionend", () => {
      if (this.dom.style.opacity == "0")
        this.dom.style.display = this.pointer.style.display = ""
    })

    this.active = 0
    this.open = false
    this.lastLeft = this.lastRight = null
  }

  detach() {
    this.dom.parentNode.removeChild(this.dom)
    this.pointer.parentNode.removeChild(this.pointer)
  }

  getSize(type, node) {
    let known = type && this.knownSizes[type]
    if (!known) {
      let wrap = this.pm.wrapper.appendChild(elt("div", {class: prefix}, node))
      wrap.style.display = "block"
      known = {width: wrap.offsetWidth, height: wrap.offsetHeight}
      if (type) this.knownSizes[type] = known
      wrap.parentNode.removeChild(wrap)
    }
    return known
  }

  show(type, node, pos) {
    if (this.pm.mod.tooltip && this.pm.mod.tooltip != this)
      this.pm.mod.tooltip.close()
    this.pm.mod.tooltip = this

    let left = this.lastLeft = pos ? pos.left : this.lastLeft
    let top = this.lastTop = pos ? pos.top : this.lastTop

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
    } else { // left/right
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
    }

    getComputedStyle(this.dom).opacity
    getComputedStyle(this.pointer).opacity
    this.dom.style.opacity = this.pointer.style.opacity = 1
    this.open = true
  }

  close() {
    if (this.open) {
      this.open = false
      this.active = 0
      if (this.pm.mod.tooltip == this) this.pm.mod.tooltip = null
      this.dom.style.opacity = this.pointer.style.opacity = 0
    }
  }
}
